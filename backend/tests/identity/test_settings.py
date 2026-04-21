"""Tests for app.gateway.identity.settings."""

import os
from unittest.mock import patch

from app.gateway.identity.settings import get_identity_settings


def test_defaults_flag_off_when_env_unset():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ENABLE_IDENTITY", None)
        get_identity_settings.cache_clear()
        settings = get_identity_settings()
    assert settings.enabled is False


def test_flag_on_when_truthy_env():
    for val in ["1", "true", "True", "TRUE", "yes", "on"]:
        with patch.dict(os.environ, {"ENABLE_IDENTITY": val}):
            get_identity_settings.cache_clear()
            assert get_identity_settings().enabled is True, f"ENABLE_IDENTITY={val!r} should enable"


def test_flag_off_when_falsy_env():
    for val in ["0", "false", "False", "no", "off", ""]:
        with patch.dict(os.environ, {"ENABLE_IDENTITY": val}):
            get_identity_settings.cache_clear()
            assert get_identity_settings().enabled is False, f"ENABLE_IDENTITY={val!r} should disable"


def test_database_url_default():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("DEERFLOW_DATABASE_URL", None)
        get_identity_settings.cache_clear()
        assert get_identity_settings().database_url == "postgresql+asyncpg://deerflow:deerflow@localhost:5432/deerflow"


def test_database_url_from_env():
    with patch.dict(os.environ, {"DEERFLOW_DATABASE_URL": "postgresql+asyncpg://u:p@h:1/d"}):
        get_identity_settings.cache_clear()
        assert get_identity_settings().database_url == "postgresql+asyncpg://u:p@h:1/d"


def test_redis_url_default_and_override():
    get_identity_settings.cache_clear()
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("DEERFLOW_REDIS_URL", None)
        get_identity_settings.cache_clear()
        assert get_identity_settings().redis_url == "redis://localhost:6379/0"
    with patch.dict(os.environ, {"DEERFLOW_REDIS_URL": "redis://r:6379/5"}):
        get_identity_settings.cache_clear()
        assert get_identity_settings().redis_url == "redis://r:6379/5"


def test_bootstrap_admin_email_optional():
    get_identity_settings.cache_clear()
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("DEERFLOW_BOOTSTRAP_ADMIN_EMAIL", None)
        get_identity_settings.cache_clear()
        assert get_identity_settings().bootstrap_admin_email is None
    with patch.dict(os.environ, {"DEERFLOW_BOOTSTRAP_ADMIN_EMAIL": "admin@example.com"}):
        get_identity_settings.cache_clear()
        assert get_identity_settings().bootstrap_admin_email == "admin@example.com"


def test_settings_cached_between_calls():
    get_identity_settings.cache_clear()
    first = get_identity_settings()
    second = get_identity_settings()
    assert first is second
