"""Shared fixtures for identity tests.

Fixtures that require Postgres/Redis are guarded: tests skip when the
containers are unavailable so a bare `make test` passes on laptops.
"""

import os

import pytest

_HAVE_DOCKER = os.environ.get("IDENTITY_TEST_BACKEND", "auto") != "off"


@pytest.fixture(scope="session")
def have_docker() -> bool:
    return _HAVE_DOCKER
