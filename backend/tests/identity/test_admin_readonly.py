"""Route-level tests for the admin read router.

We inject a synthetic ``Identity`` via middleware and override ``get_session``
with a stub returning canned rows — no live DB/Redis needed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.gateway.identity.auth.identity import Identity
from app.gateway.identity.bootstrap import PREDEFINED_ROLE_PERMISSIONS
from app.gateway.identity.db import get_session
from app.gateway.identity.routers import admin as admin_router_module


def _identity_for_role(role_key: str, *, tenant_id: int, workspace_ids: tuple[int, ...] = (1,)) -> Identity:
    """Build an Identity matching a bootstrap seed role (mirrors rbac/test_horizontal_access.py)."""
    platform_roles: list[str] = []
    tenant_roles: list[str] = []
    workspace_role_map: dict[str, str] = {}
    perms: set[str] = set()
    for (key, scope), tags in PREDEFINED_ROLE_PERMISSIONS.items():
        if key == role_key:
            if scope == "platform":
                platform_roles.append(key)
            elif scope == "tenant":
                tenant_roles.append(key)
                perms.update(tags)
            elif scope == "workspace":
                for wid in workspace_ids:
                    workspace_role_map[str(wid)] = key
                perms.update(tags)
    if role_key == "platform_admin":
        perms = set()  # platform_admin bypasses via is_platform_admin
    return Identity(
        token_type="jwt",
        user_id=1,
        email=f"{role_key}@example.com",
        tenant_id=tenant_id,
        workspace_ids=workspace_ids,
        permissions=frozenset(perms),
        roles={"platform": platform_roles, "tenant": tenant_roles, "workspaces": workspace_role_map},
        session_id=f"sess-{role_key}",
    )


class _StubSession:
    """Minimal AsyncSession stub. Tests set ``.rows`` on the instance and
    assert ``.executed_stmts`` after the call."""

    def __init__(self, rows: list[Any] | None = None, scalar_result: Any = None):
        self.rows = rows or []
        self.scalar_result = scalar_result
        self.executed_stmts: list[Any] = []

    async def execute(self, stmt):  # noqa: D401
        self.executed_stmts.append(stmt)
        result = MagicMock()
        result.scalars.return_value.all.return_value = list(self.rows)
        result.scalar.return_value = self.scalar_result
        result.scalar_one.return_value = self.scalar_result
        return result


@pytest.fixture
def admin_app():
    """FastAPI app mounting the admin router with injected Identity + stub session."""
    app = FastAPI()
    app.include_router(admin_router_module.router)
    current: dict = {"identity": Identity.anonymous(), "session": _StubSession()}

    @app.middleware("http")
    async def inject_identity(request, call_next):
        request.state.identity = current["identity"]
        return await call_next(request)

    async def _override_session() -> AsyncIterator[_StubSession]:
        yield current["session"]

    app.dependency_overrides[get_session] = _override_session
    return app, current


def test_list_tenants_allowed_for_platform_admin(admin_app):
    app, holder = admin_app
    holder["identity"] = _identity_for_role("platform_admin", tenant_id=1)
    holder["session"] = _StubSession(
        rows=[
            SimpleNamespace(
                id=1,
                slug="acme",
                name="Acme",
                plan="pro",
                status=1,
                created_at=datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc),
            ),
            SimpleNamespace(
                id=2,
                slug="hooli",
                name="Hooli",
                plan="free",
                status=1,
                created_at=datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc),
            ),
        ],
        scalar_result=2,
    )
    with TestClient(app) as c:
        r = c.get("/api/admin/tenants")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["slug"] == "acme"
    assert body["items"][0]["name"] == "Acme"
    assert body["items"][0]["plan"] == "pro"
    assert body["items"][0]["status"] == 1
    assert body["items"][0]["created_at"].startswith("2026-04-01")


def test_list_tenants_forbidden_for_tenant_owner(admin_app):
    app, holder = admin_app
    holder["identity"] = _identity_for_role("tenant_owner", tenant_id=1)
    with TestClient(app) as c:
        r = c.get("/api/admin/tenants")
    assert r.status_code == 403


def test_list_tenants_401_when_anonymous(admin_app):
    app, _ = admin_app
    with TestClient(app) as c:
        r = c.get("/api/admin/tenants")
    assert r.status_code == 401
