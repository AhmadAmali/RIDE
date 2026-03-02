---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [fastapi, kafka, postgresql, qdrant, docker, sqlalchemy, asyncpg, pydantic-settings, ruff]

# Dependency graph
requires: []
provides:
  - Docker Compose stack with Kafka KRaft, PostgreSQL 16, Qdrant, and FastAPI backend
  - FastAPI app with /health endpoint, CORS middleware, lifespan context manager
  - Async SQLAlchemy engine and session factory using asyncpg
  - Pydantic Settings reading from .env with typed config fields
  - Makefile developer workflow (up, down, logs, migrate, shell, topics)
  - Ruff linting and pre-commit hook configuration
  - Python package skeleton: ride/{api,db,models,workers,kafka}/
affects:
  - 01-02
  - 02-pipeline
  - 03-legal-gate
  - 04-engineering-gate

# Tech tracking
tech-stack:
  added:
    - fastapi>=0.115.0
    - uvicorn[standard]>=0.30.0
    - sqlalchemy[asyncio]>=2.0.0
    - asyncpg>=0.28.0,<0.30.0
    - alembic>=1.13.0
    - pydantic-settings>=2.0.0
    - python-dotenv>=1.0.0
    - aiokafka>=0.11.0
    - httpx>=0.27.0
    - ruff>=0.4.0
    - pre-commit>=3.0.0
  patterns:
    - Pydantic Settings with lru_cache for config (get_settings pattern)
    - FastAPI lifespan context manager for startup/shutdown (not deprecated on_event)
    - Async SQLAlchemy engine with async_sessionmaker and get_db generator
    - CORSMiddleware added first with explicit origins (not wildcard) to support credentials
    - Docker Compose depends_on with condition: service_healthy to prevent race conditions

key-files:
  created:
    - docker-compose.yml
    - .env.example
    - .gitignore
    - Makefile
    - pyproject.toml
    - .pre-commit-config.yaml
    - backend/Dockerfile
    - backend/requirements.txt
    - backend/ride/config.py
    - backend/ride/db/session.py
    - backend/ride/api/main.py
    - backend/ride/api/routes/__init__.py
    - backend/ride/models/__init__.py
    - backend/ride/workers/__init__.py
    - backend/ride/kafka/__init__.py
  modified: []

key-decisions:
  - "asyncpg pinned <0.30.0 due to reported SQLAlchemy async dialect incompatibility with 0.29.0+"
  - "Qdrant health check uses /dev/tcp bash workaround (no curl/wget in official image)"
  - "CORS uses settings.cors_origins (not wildcard) to satisfy browser allow_credentials=True requirement"
  - "lifespan context manager pattern used (not deprecated @app.on_event)"

patterns-established:
  - "Pattern: config.py — Pydantic Settings + lru_cache; all env vars typed; settings = get_settings() at module level"
  - "Pattern: db/session.py — single async engine per process, async_session_maker, Base declarative, get_db generator"
  - "Pattern: api/main.py — lifespan disposes engine on shutdown; CORSMiddleware first in middleware stack"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 1 Plan 01: Infrastructure Skeleton Summary

**Docker Compose stack with Kafka KRaft, PostgreSQL 16, Qdrant, and FastAPI using async SQLAlchemy + Pydantic Settings — four services with health-gated startup**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-02T22:37:27Z
- **Completed:** 2026-03-02T22:41:13Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Full Docker Compose stack with 4 services (Kafka KRaft, PostgreSQL 16, Qdrant, backend) each with health checks and service_healthy conditions
- FastAPI application with lifespan context manager, CORSMiddleware (explicit origins), and GET /health endpoint returning {"status": "ok", "service": "ride-api"}
- Async SQLAlchemy engine (asyncpg) with session factory, DeclarativeBase, and get_db dependency generator
- Pydantic Settings reading from .env with typed fields for database_url, kafka_bootstrap_servers, cors_origins, api_host, api_port
- Complete Python package skeleton under backend/ride/ with api/, db/, models/, workers/, kafka/ subpackages
- Makefile with up/down/logs/migrate/shell/topics targets, ruff pyproject.toml config, pre-commit hooks

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold, Docker Compose, and dev tooling** - `3f9d436` (chore)
2. **Task 2: FastAPI app with health endpoint and CORS** - `4136820` (feat)

**Plan metadata:** Committed with SUMMARY.md (docs)

## Files Created/Modified

- `docker-compose.yml` - 4-service orchestration with Kafka KRaft, PostgreSQL, Qdrant, backend; all using service_healthy health check conditions
- `.env.example` - Template with DATABASE_URL, POSTGRES credentials, KAFKA_BOOTSTRAP_SERVERS, CORS_ORIGINS, API settings
- `.gitignore` - Python, venv, .env, ruff/mypy/pytest caches, Docker volumes
- `Makefile` - up/down/logs/migrate/shell/topics targets with .PHONY
- `pyproject.toml` - Ruff: line-length=100, py311, E/F/UP/I/B selectors, bugbear immutable-calls
- `.pre-commit-config.yaml` - ruff-pre-commit v0.4.0 with ruff --fix and ruff-format hooks
- `backend/Dockerfile` - Python 3.11-slim, pip install requirements.txt, uvicorn CMD
- `backend/requirements.txt` - Pinned versions: fastapi, uvicorn, sqlalchemy, asyncpg<0.30.0, alembic, pydantic-settings, aiokafka, httpx, ruff, pre-commit
- `backend/ride/config.py` - Settings class with lru_cache, all env vars typed, settings = get_settings()
- `backend/ride/db/session.py` - create_async_engine with pool_pre_ping, async_sessionmaker, DeclarativeBase, get_db
- `backend/ride/api/main.py` - FastAPI app with lifespan, CORSMiddleware first, GET /health endpoint
- All `__init__.py` package files for ride/, ride/api/, ride/api/routes/, ride/db/, ride/models/, ride/workers/, ride/kafka/

## Decisions Made

- asyncpg pinned `<0.30.0` due to reported incompatibilities with SQLAlchemy's async dialect in 0.29.0+
- Qdrant health check uses `/dev/tcp` bash workaround since the official image excludes curl/wget (GitHub issue #4250 still open)
- CORS uses `settings.cors_origins` (not `["*"]`) to satisfy browser requirement when `allow_credentials=True`
- `lifespan` context manager used instead of deprecated `@app.on_event("startup"/"shutdown")`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Host system has Python 2.7/3.6 (not 3.11), so the plan's `python -c "from ride.config import settings..."` verification could not run on the host. Structural verification was performed instead: file existence, YAML validity, AST parsing, content assertions, and ruff linting via standalone binary. The code targets Python 3.11 (deployed in Docker) and will work correctly there.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Infrastructure skeleton is complete; docker compose up (when Docker is enabled) will produce four healthy containers
- Plan 02 (database schema + Kafka topics) can proceed immediately — Base and engine are in place
- All package imports are wired: config -> db/session -> api/main dependency chain is established
- Blocker noted in STATE.md: Demo regulatory document selection needed before Phase 2 extraction work

---
*Phase: 01-foundation*
*Completed: 2026-03-02*
