import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.gateway.config import get_gateway_config
from app.gateway.deps import langgraph_runtime
from app.gateway.identity import db as _identity_db
from app.gateway.identity.auth.config import load_oidc_providers
from app.gateway.identity.auth.jwt import ensure_rsa_keypair
from app.gateway.identity.auth.lockout import LoginLockout
from app.gateway.identity.auth.oidc import OIDCClient
from app.gateway.identity.auth.runtime import AuthRuntime, clear_runtime, set_runtime
from app.gateway.identity.auth.session import SessionStore
from app.gateway.identity.bootstrap import bootstrap as identity_bootstrap
from app.gateway.identity.db import clear_global_engine, create_engine_and_sessionmaker, set_global_engine
from app.gateway.identity.middlewares.identity import IdentityMiddleware
from app.gateway.identity.routers import auth as identity_auth_router
from app.gateway.identity.routers import me as identity_me_router
from app.gateway.identity.settings import get_identity_settings
from app.gateway.routers import (
    agents,
    artifacts,
    assistants_compat,
    channels,
    mcp,
    memory,
    models,
    runs,
    skills,
    suggestions,
    thread_runs,
    threads,
    uploads,
)
from deerflow.config.app_config import get_app_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)


class _LazyIdentityMiddleware:
    """Defer construction of IdentityMiddleware until the auth runtime exists.

    Starlette instantiates middleware when the app starts serving; lifespan
    runs before any request, so by then ``get_runtime()`` is valid.
    """

    def __init__(self, app):
        self._app = app
        self._wrapped = None

    async def __call__(self, scope, receive, send):
        if scope["type"] == "lifespan":
            return await self._app(scope, receive, send)
        if self._wrapped is None:
            from app.gateway.identity.auth.runtime import get_runtime

            rt = get_runtime()
            self._wrapped = IdentityMiddleware(
                self._app,
                public_key_pem=rt.jwt_public_key_pem,
                session_store=rt.session_store,
                session_maker=rt.session_maker,
                issuer=rt.issuer,
                audience=rt.audience,
                cookie_name=rt.cookie_name,
            )
        return await self._wrapped(scope, receive, send)


async def _init_identity_subsystem() -> None:
    settings = get_identity_settings()
    if not settings.enabled:
        logger.info("ENABLE_IDENTITY=false; skipping identity subsystem initialization")
        return

    logger.info("ENABLE_IDENTITY=true; initializing identity subsystem")
    engine, maker = create_engine_and_sessionmaker(settings.database_url)
    set_global_engine(engine, maker)

    async with maker() as session:
        await identity_bootstrap(session, bootstrap_admin_email=settings.bootstrap_admin_email)

    # M2: build the AuthRuntime (JWT keys, session store, OIDC clients, lockout).
    await _init_auth_runtime(settings, maker)


async def _init_auth_runtime(settings, session_maker) -> None:
    import os

    import redis.asyncio as aioredis

    # JWT keys: inline env beats file path.
    if settings.jwt_private_key:
        priv_pem = settings.jwt_private_key
        # Public is derived from private — cryptography doesn't give us a string
        # trivially here, so require the path as a fallback for public.
        with open(settings.jwt_public_key_path) as f:
            pub_pem = f.read()
    else:
        priv_pem, pub_pem = ensure_rsa_keypair(settings.jwt_private_key_path, settings.jwt_public_key_path)

    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    session_store = SessionStore(redis_client, refresh_ttl_sec=settings.refresh_token_ttl_sec)
    lockout = LoginLockout(
        redis_client,
        max_attempts=settings.login_lockout_max_attempts,
        window_sec=settings.login_lockout_window_sec,
        block_sec=settings.login_lockout_block_sec,
    )

    # OIDC providers from config/identity.yaml (optional).
    oidc_path = os.environ.get("DEERFLOW_IDENTITY_CONFIG", "config/identity.yaml")
    providers = load_oidc_providers(oidc_path)
    oidc_clients = {name: OIDCClient(cfg, redis_client=redis_client) for name, cfg in providers.items()}

    runtime = AuthRuntime(
        jwt_private_key_pem=priv_pem,
        jwt_public_key_pem=pub_pem,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        access_ttl_sec=settings.access_token_ttl_sec,
        refresh_ttl_sec=settings.refresh_token_ttl_sec,
        cookie_name=settings.cookie_name,
        cookie_secure=settings.cookie_secure,
        oidc_clients=oidc_clients,
        session_store=session_store,
        lockout=lockout,
        redis_client=redis_client,
        session_maker=session_maker,
        auto_provision=settings.auto_provision_tenant,
    )
    set_runtime(runtime)
    logger.info("identity auth runtime ready (providers: %s)", sorted(providers))


async def _shutdown_identity_subsystem() -> None:
    settings = get_identity_settings()
    if not settings.enabled:
        return
    if _identity_db._engine is not None:
        await _identity_db._engine.dispose()
    clear_global_engine()
    clear_runtime()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler."""

    # Load config and check necessary environment variables at startup
    try:
        get_app_config()
        logger.info("Configuration loaded successfully")
    except Exception as e:
        error_msg = f"Failed to load configuration during gateway startup: {e}"
        logger.exception(error_msg)
        raise RuntimeError(error_msg) from e
    config = get_gateway_config()
    logger.info(f"Starting API Gateway on {config.host}:{config.port}")

    # Initialize identity subsystem (no-op when ENABLE_IDENTITY=false)
    await _init_identity_subsystem()

    # Initialize LangGraph runtime components (StreamBridge, RunManager, checkpointer, store)
    async with langgraph_runtime(app):
        logger.info("LangGraph runtime initialised")

        # Start IM channel service if any channels are configured
        try:
            from app.channels.service import start_channel_service

            channel_service = await start_channel_service()
            logger.info("Channel service started: %s", channel_service.get_status())
        except Exception:
            logger.exception("No IM channels configured or channel service failed to start")

        try:
            yield
        finally:
            # Stop channel service on shutdown
            try:
                from app.channels.service import stop_channel_service

                await stop_channel_service()
            except Exception:
                logger.exception("Failed to stop channel service")

            await _shutdown_identity_subsystem()

    logger.info("Shutting down API Gateway")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application instance.
    """

    app = FastAPI(
        title="DeerFlow API Gateway",
        description="""
## DeerFlow API Gateway

API Gateway for DeerFlow - A LangGraph-based AI agent backend with sandbox execution capabilities.

### Features

- **Models Management**: Query and retrieve available AI models
- **MCP Configuration**: Manage Model Context Protocol (MCP) server configurations
- **Memory Management**: Access and manage global memory data for personalized conversations
- **Skills Management**: Query and manage skills and their enabled status
- **Artifacts**: Access thread artifacts and generated files
- **Health Monitoring**: System health check endpoints

### Architecture

LangGraph requests are handled by nginx reverse proxy.
This gateway provides custom endpoints for models, MCP configuration, skills, and artifacts.
        """,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=[
            {
                "name": "models",
                "description": "Operations for querying available AI models and their configurations",
            },
            {
                "name": "mcp",
                "description": "Manage Model Context Protocol (MCP) server configurations",
            },
            {
                "name": "memory",
                "description": "Access and manage global memory data for personalized conversations",
            },
            {
                "name": "skills",
                "description": "Manage skills and their configurations",
            },
            {
                "name": "artifacts",
                "description": "Access and download thread artifacts and generated files",
            },
            {
                "name": "uploads",
                "description": "Upload and manage user files for threads",
            },
            {
                "name": "threads",
                "description": "Manage DeerFlow thread-local filesystem data",
            },
            {
                "name": "agents",
                "description": "Create and manage custom agents with per-agent config and prompts",
            },
            {
                "name": "suggestions",
                "description": "Generate follow-up question suggestions for conversations",
            },
            {
                "name": "channels",
                "description": "Manage IM channel integrations (Feishu, Slack, Telegram)",
            },
            {
                "name": "assistants-compat",
                "description": "LangGraph Platform-compatible assistants API (stub)",
            },
            {
                "name": "runs",
                "description": "LangGraph Platform-compatible runs lifecycle (create, stream, cancel)",
            },
            {
                "name": "health",
                "description": "Health check and system status endpoints",
            },
        ],
    )

    # CORS is handled by nginx - no need for FastAPI middleware

    # Include routers
    # Models API is mounted at /api/models
    app.include_router(models.router)

    # MCP API is mounted at /api/mcp
    app.include_router(mcp.router)

    # Memory API is mounted at /api/memory
    app.include_router(memory.router)

    # Skills API is mounted at /api/skills
    app.include_router(skills.router)

    # Artifacts API is mounted at /api/threads/{thread_id}/artifacts
    app.include_router(artifacts.router)

    # Uploads API is mounted at /api/threads/{thread_id}/uploads
    app.include_router(uploads.router)

    # Thread cleanup API is mounted at /api/threads/{thread_id}
    app.include_router(threads.router)

    # Agents API is mounted at /api/agents
    app.include_router(agents.router)

    # Suggestions API is mounted at /api/threads/{thread_id}/suggestions
    app.include_router(suggestions.router)

    # Channels API is mounted at /api/channels
    app.include_router(channels.router)

    # Assistants compatibility API (LangGraph Platform stub)
    app.include_router(assistants_compat.router)

    # Thread Runs API (LangGraph Platform-compatible runs lifecycle)
    app.include_router(thread_runs.router)

    # Stateless Runs API (stream/wait without a pre-existing thread)
    app.include_router(runs.router)

    # Identity subsystem: register middleware + /api/auth + /api/me only when
    # ENABLE_IDENTITY=true. The middleware reads the auth runtime lazily so
    # registration order (before lifespan) is not a problem.
    if get_identity_settings().enabled:
        app.include_router(identity_auth_router.router)
        app.include_router(identity_me_router.router)
        app.add_middleware(_LazyIdentityMiddleware)

    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        """Health check endpoint.

        Returns:
            Service health status information.
        """
        return {"status": "healthy", "service": "deer-flow-gateway"}

    return app


# Create app instance for uvicorn
app = create_app()
