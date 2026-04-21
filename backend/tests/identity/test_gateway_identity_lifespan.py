"""Gateway must preserve legacy behavior when flag=false,
and must init engine + bootstrap when flag=true."""

import asyncio
from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_flag_off_skips_identity_init(monkeypatch):
    monkeypatch.setenv("ENABLE_IDENTITY", "false")
    from app.gateway.identity.settings import get_identity_settings

    get_identity_settings.cache_clear()

    with patch("app.gateway.app.create_engine_and_sessionmaker") as ce:
        from app.gateway.app import _init_identity_subsystem

        await _init_identity_subsystem()
        assert ce.call_count == 0


@pytest.mark.asyncio
async def test_flag_on_inits_engine_and_bootstraps(monkeypatch, pg_url):
    monkeypatch.setenv("ENABLE_IDENTITY", "true")
    monkeypatch.setenv("DEERFLOW_DATABASE_URL", pg_url)
    monkeypatch.setenv("DEERFLOW_BOOTSTRAP_ADMIN_EMAIL", "boot@example.com")

    from app.gateway.identity.settings import get_identity_settings

    get_identity_settings.cache_clear()

    from alembic.config import Config

    from alembic import command

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", pg_url)
    await asyncio.to_thread(command.upgrade, cfg, "head")

    try:
        from app.gateway.app import _init_identity_subsystem, _shutdown_identity_subsystem

        await _init_identity_subsystem()

        from sqlalchemy import select

        from app.gateway.identity import db as db_module
        from app.gateway.identity.models import User

        maker = db_module._sessionmaker
        assert maker is not None
        async with maker() as session:
            users = (await session.execute(select(User).where(User.email == "boot@example.com"))).scalars().all()
        assert len(users) == 1

        await _shutdown_identity_subsystem()
    finally:
        await asyncio.to_thread(command.downgrade, cfg, "base")
