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
