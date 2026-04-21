"""Regression guard: with ENABLE_IDENTITY=false the gateway must behave
exactly like before (no DB required, legacy endpoints unaffected).

If this test fails, M1 has broken backwards compatibility. Fix that first."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_flag_off(monkeypatch):
    monkeypatch.setenv("ENABLE_IDENTITY", "false")
    # Point DATABASE_URL at nothing; any accidental use will surface fast.
    monkeypatch.setenv("DEERFLOW_DATABASE_URL", "postgresql+asyncpg://nobody:nobody@127.0.0.1:1/none")

    from app.gateway.identity.settings import get_identity_settings

    get_identity_settings.cache_clear()

    from app.gateway.app import app

    with TestClient(app) as c:
        yield c


def test_health_endpoint_still_responds(client_flag_off):
    r = client_flag_off.get("/health")
    assert r.status_code == 200


def test_identity_globals_not_initialised(client_flag_off):
    from app.gateway.identity.db import _engine, _sessionmaker

    assert _engine is None
    assert _sessionmaker is None


def test_models_endpoint_still_responds(client_flag_off):
    """Spot-check: a pre-existing gateway route works without identity."""
    r = client_flag_off.get("/api/models")
    # 200 with list, or 404/500 if config missing, but NOT an auth/identity error
    assert r.status_code in (200, 404, 500)
    body = r.text.lower()
    assert "identity" not in body, f"Identity leak into legacy endpoint: {body[:200]}"
