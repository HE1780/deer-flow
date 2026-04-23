"""Admin read endpoints (M7 A2).

Paired with ``routers/admin_stub.py`` — the stub ``POST /api/admin/tenants``
stays put until A3 replaces it with a real handler. This module only adds
reads.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gateway.identity.db import get_session
from app.gateway.identity.models import (
    ApiToken,
    Membership,
    Role,
    Tenant,
    User,
    UserRole,
    Workspace,
    WorkspaceMember,
)
from app.gateway.identity.rbac.decorator import requires

router = APIRouter(tags=["identity-admin"])


def _tenant_row(t: Tenant) -> dict[str, Any]:
    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "plan": t.plan,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get(
    "/api/admin/tenants",
    dependencies=[Depends(requires("tenant:read", "platform"))],
)
async def list_tenants(
    q: str | None = Query(default=None, description="Filter by slug (ILIKE)"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> dict:
    conditions = []
    if q:
        conditions.append(Tenant.slug.ilike(f"%{q}%"))
    stmt = select(Tenant)
    if conditions:
        stmt = stmt.where(*conditions)
    stmt = stmt.order_by(Tenant.created_at.desc()).offset(offset).limit(limit)

    count_stmt = select(func.count()).select_from(Tenant)
    if conditions:
        count_stmt = count_stmt.where(*conditions)

    rows = (await session.execute(stmt)).scalars().all()
    total = (await session.execute(count_stmt)).scalar() or 0
    return {"items": [_tenant_row(t) for t in rows], "total": int(total)}


@router.get(
    "/api/admin/tenants/{tid}",
    dependencies=[Depends(requires("tenant:read", "platform"))],
)
async def get_tenant(
    tid: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant = (await session.execute(select(Tenant).where(Tenant.id == tid))).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="tenant not found")
    member_count = (
        await session.execute(select(func.count()).select_from(Membership).where(Membership.tenant_id == tid))
    ).scalar() or 0
    workspace_count = (
        await session.execute(select(func.count()).select_from(Workspace).where(Workspace.tenant_id == tid))
    ).scalar() or 0
    return {
        **_tenant_row(tenant),
        "member_count": int(member_count),
        "workspace_count": int(workspace_count),
    }


def _user_row(u: User, role_keys: list[str]) -> dict[str, Any]:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "avatar_url": u.avatar_url,
        "status": u.status,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "roles": role_keys,
    }


@router.get(
    "/api/tenants/{tid}/users",
    dependencies=[Depends(requires("membership:read", "tenant"))],
)
async def list_users(
    tid: int,
    q: str | None = Query(default=None, description="Filter by email (ILIKE)"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> dict:
    u_stmt = (
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.tenant_id == tid)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if q:
        u_stmt = u_stmt.where(User.email.ilike(f"%{q}%"))
    users = (await session.execute(u_stmt)).scalars().all()

    count_stmt = (
        select(func.count(User.id.distinct()))
        .select_from(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.tenant_id == tid)
    )
    if q:
        count_stmt = count_stmt.where(User.email.ilike(f"%{q}%"))
    total = (await session.execute(count_stmt)).scalar() or 0

    # Roles per listed user (one query, then pivot). NULL tenant_id = platform grant.
    user_ids = [u.id for u in users]
    if user_ids:
        role_stmt = (
            select(UserRole.user_id, Role.role_key)
            .join(Role, Role.id == UserRole.role_id)
            .where(UserRole.user_id.in_(user_ids))
            .where((UserRole.tenant_id == tid) | (UserRole.tenant_id.is_(None)))
        )
        role_pairs = (await session.execute(role_stmt)).all()
    else:
        role_pairs = []
    by_user: dict[int, list[str]] = {}
    for uid, rk in role_pairs:
        by_user.setdefault(uid, []).append(rk)

    return {
        "items": [_user_row(u, sorted(by_user.get(u.id, []))) for u in users],
        "total": int(total),
    }


@router.get(
    "/api/tenants/{tid}/users/{uid}",
    dependencies=[Depends(requires("membership:read", "tenant"))],
)
async def get_user(
    tid: int,
    uid: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    u_stmt = (
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.tenant_id == tid, User.id == uid)
    )
    user = (await session.execute(u_stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    role_stmt = (
        select(Role.role_key)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == uid)
        .where((UserRole.tenant_id == tid) | (UserRole.tenant_id.is_(None)))
    )
    role_keys = [r[0] for r in (await session.execute(role_stmt)).all()]
    return _user_row(user, sorted(role_keys))
