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


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _deerflow_home() -> str:
    return os.environ.get("DEERFLOW_HOME") or os.path.join(os.path.expanduser("~"), ".deerflow")


def _deer_flow_home() -> str:
    """Resolve the M4 ``DEER_FLOW_HOME`` for the storage layout.

    Resolution matches ``app.gateway.identity.storage.paths.deerflow_home``:

    1. ``$DEER_FLOW_HOME`` env var if set and non-empty.
    2. Repo-local fallback ``{backend_dir}/.deer-flow`` (computed from this
       module's own path, so it is independent of CWD).

    This helper is intentionally duplicated with
    ``app.gateway.identity.storage.paths`` (rather than imported) so that
    ``storage.paths`` never needs to import ``settings`` — keeping the
    path-construction layer free of circular dependencies.
    """

    env = os.environ.get("DEER_FLOW_HOME")
    if env:
        return os.path.abspath(os.path.expanduser(env))
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    return os.path.join(backend_dir, ".deer-flow")


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
    # M4 storage layout root (distinct from the legacy DEERFLOW_HOME used for JWT keys).
    # Resolved at read time so test monkeypatching of DEER_FLOW_HOME works naturally.
    deer_flow_home: str
    # M2 auth settings
    jwt_private_key: str | None
    jwt_private_key_path: str
    jwt_public_key_path: str
    jwt_issuer: str
    jwt_audience: str
    access_token_ttl_sec: int
    refresh_token_ttl_sec: int
    cookie_name: str
    cookie_secure: bool
    login_lockout_max_attempts: int
    login_lockout_window_sec: int
    login_lockout_block_sec: int
    bcrypt_cost: int
    internal_signing_key: str | None


@lru_cache(maxsize=1)
def get_identity_settings() -> IdentitySettings:
    home = _deerflow_home()
    system_dir = os.path.join(home, "_system")
    return IdentitySettings(
        enabled=_env_bool("ENABLE_IDENTITY", default=False),
        database_url=os.environ.get(
            "DEERFLOW_DATABASE_URL",
            "postgresql+asyncpg://deerflow:deerflow@localhost:5432/deerflow",
        ),
        redis_url=os.environ.get("DEERFLOW_REDIS_URL", "redis://localhost:6379/0"),
        bootstrap_admin_email=os.environ.get("DEERFLOW_BOOTSTRAP_ADMIN_EMAIL") or None,
        auto_provision_tenant=_env_bool("IDENTITY_AUTO_PROVISION_TENANT", default=False),
        deer_flow_home=_deer_flow_home(),
        jwt_private_key=os.environ.get("DEERFLOW_JWT_PRIVATE_KEY") or None,
        jwt_private_key_path=os.environ.get(
            "DEERFLOW_JWT_PRIVATE_KEY_PATH",
            os.path.join(system_dir, "jwt_private.pem"),
        ),
        jwt_public_key_path=os.environ.get(
            "DEERFLOW_JWT_PUBLIC_KEY_PATH",
            os.path.join(system_dir, "jwt_public.pem"),
        ),
        jwt_issuer=os.environ.get("DEERFLOW_JWT_ISSUER", "deerflow"),
        jwt_audience=os.environ.get("DEERFLOW_JWT_AUDIENCE", "deerflow-api"),
        access_token_ttl_sec=_env_int("DEERFLOW_ACCESS_TOKEN_TTL_SEC", 900),
        refresh_token_ttl_sec=_env_int("DEERFLOW_REFRESH_TOKEN_TTL_SEC", 604800),
        cookie_name=os.environ.get("DEERFLOW_COOKIE_NAME", "deerflow_session"),
        cookie_secure=_env_bool("DEERFLOW_COOKIE_SECURE", default=True),
        login_lockout_max_attempts=_env_int("DEERFLOW_LOGIN_LOCKOUT_MAX_ATTEMPTS", 10),
        login_lockout_window_sec=_env_int("DEERFLOW_LOGIN_LOCKOUT_WINDOW_SEC", 300),
        login_lockout_block_sec=_env_int("DEERFLOW_LOGIN_LOCKOUT_BLOCK_SEC", 900),
        bcrypt_cost=_env_int("DEERFLOW_BCRYPT_COST", 12),
        internal_signing_key=os.environ.get("DEERFLOW_INTERNAL_SIGNING_KEY") or None,
    )
