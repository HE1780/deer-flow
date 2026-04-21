install:
	uv sync

dev:
	uv run langgraph dev --no-browser --no-reload --n-jobs-per-worker 10

gateway:
	PYTHONPATH=. uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001

test:
	PYTHONPATH=. uv run pytest tests/ -v

lint:
	uvx ruff check .
	uvx ruff format --check .

format:
	uvx ruff check . --fix && uvx ruff format .

# ── Identity subsystem (M1) ────────────────────────────────────────────────
db-upgrade:
	PYTHONPATH=. uv run alembic upgrade head

db-downgrade-one:
	PYTHONPATH=. uv run alembic downgrade -1

identity-bootstrap:
	PYTHONPATH=. uv run python -m app.gateway.identity.cli bootstrap

identity-test:
	PYTHONPATH=. IDENTITY_TEST_BACKEND=on uv run pytest tests/identity/ -v
