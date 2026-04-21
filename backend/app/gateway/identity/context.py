"""ContextVars used by middleware/filters across the identity subsystem.

M1 added ``current_identity`` + ``current_tenant_id`` so later milestones
can read them without further structural changes. M2 adds
``current_session_id`` for audit logging and /me route convenience.
"""

from contextvars import ContextVar
from typing import Any

current_identity: ContextVar[Any | None] = ContextVar("current_identity", default=None)
current_tenant_id: ContextVar[int | None] = ContextVar("current_tenant_id", default=None)
current_session_id: ContextVar[str | None] = ContextVar("current_session_id", default=None)
