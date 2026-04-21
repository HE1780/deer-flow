"""ContextVars used by middleware/filters in later milestones.

M1 defines them so M3's SQL auto-filter and M6's audit writer can read
them without further structural changes.
"""

from contextvars import ContextVar
from typing import Any

current_identity: ContextVar[Any | None] = ContextVar("current_identity", default=None)
current_tenant_id: ContextVar[int | None] = ContextVar("current_tenant_id", default=None)
