"""Identity subsystem settings loaded from environment variables."""

import os
from dataclasses import dataclass
from functools import lru_cache

_TRUTHY = {"1", "true", "yes", "on"}


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUTHY


@dataclass(frozen=True)
class IdentitySettings:
    """Process-level settings for the identity subsystem.

    Read at startup and cached via `get_identity_settings()`. Tests can
    clear the cache with `get_identity_settings.cache_clear()`.
    """

    enabled: bool
    database_url: str
    redis_url: str
    bootstrap_admin_email: str | None
    auto_provision_tenant: bool


@lru_cache(maxsize=1)
def get_identity_settings() -> IdentitySettings:
    return IdentitySettings(
        enabled=_env_bool("ENABLE_IDENTITY", default=False),
        database_url=os.environ.get(
            "DEERFLOW_DATABASE_URL",
            "postgresql+asyncpg://deerflow:deerflow@localhost:5432/deerflow",
        ),
        redis_url=os.environ.get("DEERFLOW_REDIS_URL", "redis://localhost:6379/0"),
        bootstrap_admin_email=os.environ.get("DEERFLOW_BOOTSTRAP_ADMIN_EMAIL") or None,
        auto_provision_tenant=_env_bool("IDENTITY_AUTO_PROVISION_TENANT", default=False),
    )
