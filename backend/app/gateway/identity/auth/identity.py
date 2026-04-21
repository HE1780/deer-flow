"""The ``Identity`` dataclass attached to every request after middleware runs.

This is the *runtime* identity (read by routes, decorators, audit writer),
as distinct from the ORM ``User``/``Tenant``/``Role`` rows that back it.

M3 will expand this with permission-checking helpers; M2 only needs the
shape to be stable enough for Task 9 (middleware) and Task 11 (/me).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

TokenType = Literal["anonymous", "jwt", "api_token"]


@dataclass(frozen=True)
class Identity:
    """Authenticated request principal.

    ``token_type == "anonymous"`` → everything else is empty/None.
    """

    token_type: TokenType
    user_id: int | None
    email: str | None
    tenant_id: int | None
    workspace_ids: tuple[int, ...] = ()
    permissions: frozenset[str] = field(default_factory=frozenset)
    roles: dict = field(default_factory=dict)
    session_id: str | None = None

    @classmethod
    def anonymous(cls) -> "Identity":
        return cls(
            token_type="anonymous",
            user_id=None,
            email=None,
            tenant_id=None,
            workspace_ids=(),
            permissions=frozenset(),
            roles={},
            session_id=None,
        )

    @property
    def is_authenticated(self) -> bool:
        return self.token_type != "anonymous" and self.user_id is not None
