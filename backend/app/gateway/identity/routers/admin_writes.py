"""Admin write endpoints (M7 A3).

These complement ``routers/admin.py`` (read-only) and ``routers/me.py``
(self-service). They are scoped to tenant_owner / platform_admin via
``@requires(...)`` and enforce cross-tenant safety inline.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gateway.identity.auth.api_token import create_api_token, revoke_api_token
from app.gateway.identity.db import get_session
from app.gateway.identity.models import (
    ApiToken,
    Membership,
    Role,
    User,
    Workspace,
    WorkspaceMember,
)
from app.gateway.identity.rbac.decorator import requires

router = APIRouter(tags=["identity-admin-writes"])


# --- Schemas ---------------------------------------------------------------


# Pragmatic email regex — RFC 5322 is too permissive for our needs and we
# don't want to drag in `email-validator`. Tightened during onboarding flow.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class CreateUserIn(BaseModel):
    email: str
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def _email_shape(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email format")
        return v


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str | None
    avatar_url: str | None
    status: int
    last_login_at: str | None


class AddWorkspaceMemberIn(BaseModel):
    user_id: int
    role: str  # role_key, must be a workspace-scoped role


class PatchWorkspaceMemberIn(BaseModel):
    role: str


class WorkspaceMemberOut(BaseModel):
    id: int
    email: str
    display_name: str | None
    avatar_url: str | None
    status: int
    role: str
    joined_at: str | None = None


class CreateTenantTokenIn(BaseModel):
    name: str
    scopes: list[str]
    user_id: int  # Whose token this is. Must be a tenant member.
    workspace_id: int | None = None
    expires_at: datetime | None = None


class CreateTokenOut(BaseModel):
    id: int
    plaintext: str
    prefix: str


# --- Helpers ---------------------------------------------------------------


def _user_out(u: User | Any) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        display_name=u.display_name,
        avatar_url=u.avatar_url,
        status=u.status,
        last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
    )


def _caller_user_id(request: Request) -> int:
    identity = getattr(request.state, "identity", None)
    if identity is None or identity.user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unauthenticated")
    return identity.user_id


# --- Routes ----------------------------------------------------------------


@router.post(
    "/api/tenants/{tid}/users",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requires("membership:invite", "tenant"))],
    response_model=UserOut,
)
async def create_user(
    tid: int,
    body: CreateUserIn,
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    """Create (or attach) a user and add them to the tenant.

    Idempotency: if a user with the same email exists, reuse the row and just
    add the membership. If they're already a member, return 409.
    """
    existing = (
        await session.execute(select(User).where(User.email == body.email))
    ).scalar_one_or_none()
    if existing is None:
        user = User(
            email=body.email,
            display_name=body.display_name or body.email.split("@")[0],
            status=1,
        )
        session.add(user)
        await session.flush()
    else:
        user = existing

    member_existing = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.tenant_id == tid,
            )
        )
    ).scalar_one_or_none()
    if member_existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "user is already a member of this tenant",
        )

    session.add(Membership(user_id=user.id, tenant_id=tid))
    await session.commit()
    return _user_out(user)


def _resolve_workspace(session_result, tid: int) -> Workspace:
    ws = session_result.scalar_one_or_none()
    if ws is None or ws.tenant_id != tid:
        # Generic 404 — never leak whether a workspace exists in another tenant.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return ws


@router.post(
    "/api/tenants/{tid}/workspaces/{wid}/members",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requires("membership:invite", "tenant"))],
    response_model=WorkspaceMemberOut,
)
async def add_workspace_member(
    tid: int,
    wid: int,
    body: AddWorkspaceMemberIn,
    session: AsyncSession = Depends(get_session),
) -> WorkspaceMemberOut:
    ws = _resolve_workspace(
        await session.execute(select(Workspace).where(Workspace.id == wid)),
        tid,
    )
    user = (
        await session.execute(select(User).where(User.id == body.user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")

    membership = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == user.id, Membership.tenant_id == tid
            )
        )
    ).scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "user is not a member of this tenant",
        )

    role = (
        await session.execute(
            select(Role).where(Role.role_key == body.role, Role.scope == "workspace")
        )
    ).scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown workspace role")

    existing_member = (
        await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws.id,
                WorkspaceMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing_member is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "user is already a workspace member",
        )

    session.add(
        WorkspaceMember(
            user_id=user.id,
            workspace_id=ws.id,
            role_id=role.id,
        )
    )
    await session.commit()
    return WorkspaceMemberOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        status=user.status,
        role=role.role_key,
    )


@router.patch(
    "/api/tenants/{tid}/workspaces/{wid}/members/{uid}",
    dependencies=[Depends(requires("membership:invite", "tenant"))],
    response_model=WorkspaceMemberOut,
)
async def patch_workspace_member(
    tid: int,
    wid: int,
    uid: int,
    body: PatchWorkspaceMemberIn,
    session: AsyncSession = Depends(get_session),
) -> WorkspaceMemberOut:
    ws = _resolve_workspace(
        await session.execute(select(Workspace).where(Workspace.id == wid)),
        tid,
    )
    member = (
        await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws.id,
                WorkspaceMember.user_id == uid,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")

    role = (
        await session.execute(
            select(Role).where(Role.role_key == body.role, Role.scope == "workspace")
        )
    ).scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unknown workspace role")
    member.role_id = role.id

    user = (
        await session.execute(select(User).where(User.id == uid))
    ).scalar_one_or_none()
    if user is None:  # pragma: no cover — defensive
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")

    await session.commit()
    return WorkspaceMemberOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        status=user.status,
        role=role.role_key,
    )


@router.delete(
    "/api/tenants/{tid}/workspaces/{wid}/members/{uid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requires("membership:remove", "tenant"))],
)
async def remove_workspace_member(
    tid: int,
    wid: int,
    uid: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    ws = _resolve_workspace(
        await session.execute(select(Workspace).where(Workspace.id == wid)),
        tid,
    )
    member = (
        await session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == ws.id,
                WorkspaceMember.user_id == uid,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    await session.delete(member)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/api/tenants/{tid}/tokens",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requires("token:create", "tenant"))],
    response_model=CreateTokenOut,
)
async def create_tenant_token(
    tid: int,
    body: CreateTenantTokenIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> CreateTokenOut:
    caller = _caller_user_id(request)
    created = await create_api_token(
        session,
        user_id=body.user_id,
        tenant_id=tid,
        workspace_id=body.workspace_id,
        name=body.name,
        scopes=body.scopes,
        expires_at=body.expires_at,
        created_by=caller,
    )
    return CreateTokenOut(id=created.token_id, plaintext=created.plaintext, prefix=created.prefix)


@router.delete(
    "/api/tenants/{tid}/tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requires("token:revoke", "tenant"))],
)
async def revoke_tenant_token(
    tid: int,
    token_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    token = (
        await session.execute(select(ApiToken).where(ApiToken.id == token_id))
    ).scalar_one_or_none()
    if token is None or token.tenant_id != tid:
        # Generic 404 keeps cross-tenant existence opaque.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "token not found")
    await revoke_api_token(session, token_id=token_id, by_user_id=_caller_user_id(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
