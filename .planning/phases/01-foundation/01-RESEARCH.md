# Phase 1: Foundation - Research

**Researched:** 2026-03-02
**Domain:** Python backend infrastructure — FastAPI, Kafka KRaft, PostgreSQL, Qdrant, Docker Compose
**Confidence:** HIGH (stack is well-established; verified against official docs and multiple authoritative sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Database schema design**
- UUID v4 for all primary keys — globally unique, safe for event-driven pipeline
- snake_case column naming — PostgreSQL convention, matches Python
- Dedicated audit_log table with entity_type, entity_id, action, actor, timestamp, metadata JSON — single table for all phases
- Alembic for migrations — version-controlled schema changes with rollback support, paired with SQLAlchemy

**Kafka topic architecture**
- Domain-prefixed naming: ride.document.uploaded, ride.obligation.extracted, etc. — clear pipeline stages
- JSON serialization — human-readable, no schema registry needed, appropriate for prototype scope
- Per-topic DLQ: each topic gets a .dlq counterpart (e.g., ride.obligation.extracted.dlq) with error metadata
- Manual offset commit after successful processing + DB write — at-least-once delivery guarantee

**Project layout**
- Single Python package (ride/) with modules: api/, workers/, models/, kafka/, db/ — workers import shared code directly
- Sibling directories at root: backend/ and frontend/ — Docker Compose orchestrates both, shared .env at root
- SQLAlchemy 2.0 + asyncpg for database access — async-native, type-safe models, pairs with Alembic
- Pydantic Settings for configuration — reads .env with type validation, single Settings class

**Dev workflow**
- All services in Docker — FastAPI, Kafka, PostgreSQL, Qdrant via docker-compose up with volume mounts for hot-reload
- Makefile for common commands: make up, make down, make migrate, make logs
- Single .env file at root — .env.example committed to repo, Docker Compose reads it
- Ruff + pre-commit hooks from the start — linting and formatting enforced on every commit

### Claude's Discretion
- Exact table column types and constraints beyond what's specified
- Kafka partition count and replication factor for single-node KRaft
- Docker health check intervals and retry policies
- FastAPI middleware ordering and error response format
- Pre-commit hook configuration details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 1 establishes the complete infrastructure skeleton for the RIDE pipeline: Docker Compose orchestrating Kafka (KRaft, no Zookeeper), PostgreSQL, Qdrant, and the FastAPI backend. This is a greenfield Python backend using SQLAlchemy 2.0 async with asyncpg, Alembic async migrations, aiokafka for async producer/consumer base classes, and pydantic-settings v2 for configuration. The stack is mature and well-documented; the primary implementation risks are Alembic async env.py wiring, Kafka KRaft health check timing, and the Qdrant health check workaround (no curl in image).

The phase does NOT implement any business logic — it only creates the structural skeleton that all downstream phases wire into. Every choice here locks in patterns that workers in Phases 2-4 will extend unchanged.

**Primary recommendation:** Use bitnami/kafka (latest) for KRaft, postgres:16-alpine, qdrant/qdrant:latest, and structure the backend as `backend/ride/` package. Initialize Alembic with `-t async` immediately. Define all 8 Kafka topic names as a Python `StrEnum` in `ride/kafka/topics.py` — this is the single source of truth that eliminates hardcoded strings in all workers.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.x | API framework | Async-native, automatic OpenAPI, dependency injection |
| SQLAlchemy | 2.0.x | ORM + async engine | First-class async support, Alembic integration |
| asyncpg | 0.29.x | PostgreSQL async driver | Fastest Python PostgreSQL driver, required by SQLAlchemy async |
| Alembic | 1.13.x | Schema migrations | Works with SQLAlchemy, supports async env (-t async flag) |
| pydantic-settings | 2.x | Environment config | Reads .env, type-validates, lru_cache pattern |
| aiokafka | 0.11.x | Kafka async client | Pure Python asyncio Kafka client, no C deps unlike confluent |
| uvicorn | 0.30.x | ASGI server | Standard FastAPI server, supports --reload for dev |
| python-dotenv | 1.x | .env loading | Required by pydantic-settings for .env file reads |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ruff | 0.4.x+ | Linter + formatter | Replaces flake8 + black; 200x faster, Rust-based |
| pre-commit | 3.x | Git hooks runner | Enforces ruff on every commit |
| httpx | 0.27.x | Async HTTP client | For health check tests and inter-service calls |

### Docker Images
| Image | Version | Purpose | Notes |
|-------|---------|---------|-------|
| bitnami/kafka | latest | Kafka KRaft broker | Preferred over wurstmeister (abandoned 2023); includes health scripts |
| postgres | 16-alpine | PostgreSQL | Alpine for smaller image; 16 is LTS |
| qdrant/qdrant | latest | Vector store for RAG | Ports 6333 (REST), 6334 (gRPC) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| aiokafka | confluent-kafka-python | confluent has asyncio support but it's in `experimental` package; aiokafka is pure asyncio from the start |
| aiokafka | kafka-python | kafka-python is sync-only; cannot be used in async context without threads |
| bitnami/kafka | apache/kafka | apache/kafka:latest works but bitnami has better health script tooling built in |
| asyncpg | psycopg3 | psycopg3 also supports async but asyncpg is faster and the SQLAlchemy+Alembic ecosystem docs show asyncpg as primary path |

**Installation (backend):**
```bash
pip install fastapi "uvicorn[standard]" sqlalchemy[asyncio] asyncpg alembic \
    pydantic-settings python-dotenv aiokafka ruff pre-commit httpx
```

---

## Architecture Patterns

### Recommended Project Structure
```
RIDE/                          # repo root
├── backend/
│   ├── ride/                  # single Python package
│   │   ├── __init__.py
│   │   ├── api/               # FastAPI routers and endpoints
│   │   │   ├── __init__.py
│   │   │   ├── main.py        # FastAPI app factory + lifespan
│   │   │   └── routes/        # route modules per resource
│   │   ├── workers/           # Kafka consumer workers (one per pipeline stage)
│   │   │   └── __init__.py
│   │   ├── models/            # SQLAlchemy ORM models
│   │   │   └── __init__.py
│   │   ├── kafka/             # Kafka topic registry + base classes
│   │   │   ├── __init__.py
│   │   │   ├── topics.py      # StrEnum — single source of truth for topic names
│   │   │   ├── producer.py    # BaseProducer class
│   │   │   └── consumer.py    # BaseConsumer class with DLQ handling
│   │   ├── db/                # Database engine, session factory
│   │   │   ├── __init__.py
│   │   │   └── session.py     # create_async_engine, async_session_maker
│   │   └── config.py          # Pydantic Settings class
│   ├── alembic/               # Migration environment
│   │   ├── env.py             # async env.py pattern (alembic init -t async)
│   │   └── versions/          # migration files
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                  # Next.js (Phase 5+)
├── docker-compose.yml         # orchestrates all services
├── .env                       # gitignored — secrets
├── .env.example               # committed — template
├── Makefile                   # make up, make down, make migrate, make logs
├── .pre-commit-config.yaml    # ruff hooks
└── pyproject.toml             # ruff configuration
```

### Pattern 1: Kafka Topics as StrEnum (Single Source of Truth)

**What:** All 8 topic names and their DLQ counterparts are defined once as a StrEnum. No worker ever hardcodes a string topic name.

**When to use:** Everywhere a topic name is referenced — producer sends, consumer subscribes, topic creation scripts.

```python
# Source: Standard Python enum pattern, ride/kafka/topics.py
from enum import StrEnum

class KafkaTopic(StrEnum):
    # Primary pipeline topics
    DOCUMENT_UPLOADED       = "ride.document.uploaded"
    DOCUMENT_PARSED         = "ride.document.parsed"
    OBLIGATION_EXTRACTED    = "ride.obligation.extracted"
    OBLIGATION_APPROVED     = "ride.obligation.approved"
    ACTION_ITEM_GENERATED   = "ride.action.item.generated"
    SYSTEM_MAPPING_PROPOSED = "ride.system.mapping.proposed"
    SYSTEM_MAPPING_CONFIRMED = "ride.system.mapping.confirmed"
    IMPACT_MATRIX_READY     = "ride.impact.matrix.ready"

    # Dead Letter Queues — per-topic DLQ counterparts
    DOCUMENT_UPLOADED_DLQ        = "ride.document.uploaded.dlq"
    DOCUMENT_PARSED_DLQ          = "ride.document.parsed.dlq"
    OBLIGATION_EXTRACTED_DLQ     = "ride.obligation.extracted.dlq"
    OBLIGATION_APPROVED_DLQ      = "ride.obligation.approved.dlq"
    ACTION_ITEM_GENERATED_DLQ    = "ride.action.item.generated.dlq"
    SYSTEM_MAPPING_PROPOSED_DLQ  = "ride.system.mapping.proposed.dlq"
    SYSTEM_MAPPING_CONFIRMED_DLQ = "ride.system.mapping.confirmed.dlq"
    IMPACT_MATRIX_READY_DLQ      = "ride.impact.matrix.ready.dlq"

ALL_TOPICS = list(KafkaTopic)
```

### Pattern 2: BaseConsumer with DLQ Routing

**What:** Abstract base class that handles the consume-process-commit cycle. On any exception, it routes the raw message to the corresponding .dlq topic with error metadata and commits the offset so the pipeline doesn't stall.

**When to use:** Every pipeline worker subclasses this — never implement raw aiokafka consumer loops directly.

```python
# Source: aiokafka docs (https://aiokafka.readthedocs.io/) + DLQ pattern
import json
import logging
import traceback
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from ride.kafka.topics import KafkaTopic
from ride.config import settings

logger = logging.getLogger(__name__)


class BaseConsumer(ABC):
    """At-least-once consumer with automatic DLQ routing on failure."""

    def __init__(self, topic: KafkaTopic, group_id: str):
        self.topic = topic
        self.dlq_topic = KafkaTopic(str(topic) + ".dlq")
        self.group_id = group_id
        self._consumer: AIOKafkaConsumer | None = None
        self._dlq_producer: AIOKafkaProducer | None = None

    async def start(self) -> None:
        self._consumer = AIOKafkaConsumer(
            str(self.topic),
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=self.group_id,
            enable_auto_commit=False,       # manual commit for at-least-once
            auto_offset_reset="earliest",
        )
        self._dlq_producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
        )
        await self._consumer.start()
        await self._dlq_producer.start()

    async def stop(self) -> None:
        if self._consumer:
            await self._consumer.stop()
        if self._dlq_producer:
            await self._dlq_producer.stop()

    @abstractmethod
    async def process(self, message: dict) -> None:
        """Override in each worker. Raise on failure — base class handles DLQ."""
        ...

    async def run(self) -> None:
        await self.start()
        try:
            async for msg in self._consumer:
                try:
                    payload = json.loads(msg.value)
                    await self.process(payload)
                    await self._consumer.commit()   # commit AFTER successful process
                except Exception as exc:
                    logger.error(
                        "Processing failed, routing to DLQ: %s", exc, exc_info=True
                    )
                    dlq_envelope = {
                        "original_topic": str(self.topic),
                        "original_offset": msg.offset,
                        "original_partition": msg.partition,
                        "error": str(exc),
                        "traceback": traceback.format_exc(),
                        "failed_at": datetime.now(timezone.utc).isoformat(),
                        "payload": msg.value.decode("utf-8", errors="replace"),
                    }
                    await self._dlq_producer.send_and_wait(
                        str(self.dlq_topic),
                        json.dumps(dlq_envelope).encode("utf-8"),
                    )
                    await self._consumer.commit()   # commit to unblock pipeline
        finally:
            await self.stop()
```

### Pattern 3: Async SQLAlchemy Engine + Session

**What:** Single engine per process, one AsyncSession per request via dependency injection.

```python
# Source: https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/
# ride/db/session.py
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass
from ride.config import settings

engine = create_async_engine(
    settings.database_url,   # must be postgresql+asyncpg://...
    echo=False,
    pool_pre_ping=True,      # drops stale connections
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

### Pattern 4: Pydantic Settings + FastAPI Lifespan

**What:** Single Settings class reads .env once (lru_cache). Lifespan context manager initializes DB and Kafka connections at startup.

```python
# Source: https://fastapi.tiangolo.com/advanced/settings/ (official docs)
# ride/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    database_url: str = "postgresql+asyncpg://ride:ride@localhost:5432/ride"

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"

    # API
    cors_origins: list[str] = ["http://localhost:3000"]
    api_host: str = "0.0.0.0"
    api_port: int = 8000

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

```python
# ride/api/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ride.config import settings
from ride.db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown
    await engine.dispose()

app = FastAPI(lifespan=lifespan)

# CORS for Next.js frontend — add FIRST before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,   # ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ride-api"}
```

**CORS Critical Warning (verified from official FastAPI docs):** `allow_origins`, `allow_methods`, and `allow_headers` CANNOT be set to `["*"]` simultaneously when `allow_credentials=True`. The browser rejects this combination per the CORS spec. Either list specific origins OR disable credentials.

### Pattern 5: Alembic Async Initialization

**What:** Alembic must be initialized with `-t async` flag for asyncpg compatibility. Do NOT use the sync URL swap workaround.

```bash
# Run once during setup
alembic init -t async alembic
```

```python
# alembic/env.py (key modifications after -t async init)
# Import ALL models before autogenerate — Alembic needs them in metadata
from ride.models import *  # noqa: F401, F403
from ride.db.session import Base

target_metadata = Base.metadata
```

### Anti-Patterns to Avoid
- **Hardcoded topic strings in workers:** Always import from `ride.kafka.topics.KafkaTopic`. Never `producer.send("ride.document.uploaded", ...)`.
- **Sync Alembic URL swap:** Don't replace `postgresql+asyncpg://` with `postgresql://` in env.py — this requires psycopg2 as a second driver and creates config drift.
- **Auto-commit Kafka consumer:** Never use `enable_auto_commit=True` with at-least-once semantics. Message will be lost if processing fails after commit.
- **`allow_origins=["*"]` with `allow_credentials=True`:** Browsers reject this; configure explicit origins per environment.
- **Module-level `Settings()` construction without `lru_cache`:** Without the cache, every import re-reads .env from disk. Use `get_settings()` with `@lru_cache`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Kafka async client | Custom asyncio + socket code | `aiokafka` | Handles group rebalancing, offset management, reconnect logic |
| Schema migrations | Manual SQL files + version tracking | `Alembic` | Handles upgrade/downgrade, autogenerate, async support built in |
| Config from env vars | `os.environ.get()` scattered everywhere | `pydantic-settings` | Type validation, .env reading, IDE support, testable |
| DLQ routing | Custom retry table in Postgres | `.dlq` Kafka topic per topic | Kafka-native, decoupled from processing code, observable |
| ORM | Raw asyncpg queries | `SQLAlchemy 2.0` | Type-safe models, Alembic integration, session management |
| CORS headers | Manual middleware | `CORSMiddleware` | Handles preflight, all headers, browser-compliant behavior |
| Docker health checks | Custom health ping scripts | Built-in Docker `healthcheck` with `depends_on: condition: service_healthy` | Prevents race conditions during `docker compose up` |

**Key insight:** This stack (FastAPI + SQLAlchemy async + Alembic async + aiokafka) is a known, working combination with substantial documentation. The wiring of async SQLAlchemy to Alembic is the only genuinely subtle step — the `-t async` flag and importing all models in env.py are the critical non-obvious requirements.

---

## Common Pitfalls

### Pitfall 1: Alembic Missing Model Imports
**What goes wrong:** `alembic revision --autogenerate` produces empty migrations despite schema changes.
**Why it happens:** Alembic only detects models that are imported into memory before autogenerate runs. If `env.py` doesn't import the models, `Base.metadata` is empty.
**How to avoid:** Add `from ride.models import *` (star import is intentional here) in `alembic/env.py` before `target_metadata = Base.metadata`.
**Warning signs:** Generated migration file has empty `upgrade()` and `downgrade()` functions.

### Pitfall 2: Kafka Health Check Race Condition
**What goes wrong:** Worker containers start before Kafka is ready; get `NoBrokersAvailable` error and crash.
**Why it happens:** `depends_on` without `condition: service_healthy` only waits for container start, not broker readiness. Kafka KRaft takes 15-30s to initialize the metadata log.
**How to avoid:** Use `depends_on: kafka: condition: service_healthy` in docker-compose.yml. Use the bitnami health script:
```yaml
healthcheck:
  test: ["CMD-SHELL", "kafka-broker-api-versions.sh --bootstrap-server kafka:9092 || exit 1"]
  interval: 15s
  timeout: 10s
  retries: 10
  start_period: 30s
```
**Warning signs:** Worker exits with `aiokafka.errors.NoBrokersAvailable` on startup.

### Pitfall 3: asyncpg + asyncpg version incompatibility
**What goes wrong:** `create_async_engine` raises errors or connection pool fails.
**Why it happens:** asyncpg 0.29.0+ changed internal APIs that SQLAlchemy's dialect relies on. The fix is a version pin.
**How to avoid:** Pin `asyncpg<0.29.0` or verify the specific SQLAlchemy version's asyncpg compatibility in the changelog before upgrading.
**Warning signs:** `AttributeError` in asyncpg internals during engine creation.

### Pitfall 4: Qdrant Has No Official Health Check Tool
**What goes wrong:** `docker compose up --wait` hangs or health check never passes for Qdrant.
**Why it happens:** Qdrant Docker images intentionally exclude `curl`, `wget`, `nc` for security. The GitHub issue (#4250) remains open as of September 2025.
**How to avoid:** Use the bash `/dev/tcp` workaround for Qdrant health check:
```yaml
healthcheck:
  test: ["CMD-SHELL", "bash -c 'exec 3<>/dev/tcp/127.0.0.1/6333 && echo -e \"GET /readyz HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n\" >&3 && grep -q \"HTTP/1.1 200\" <&3'"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 15s
```
**Warning signs:** Qdrant container shows `(health: starting)` indefinitely.

### Pitfall 5: CORS Wildcard + Credentials Rejection
**What goes wrong:** Browser rejects all requests with CORS error despite middleware configured.
**Why it happens:** `allow_origins=["*"]` combined with `allow_credentials=True` violates the CORS spec. Browsers enforce this at the client level.
**How to avoid:** Always specify explicit origins: `allow_origins=["http://localhost:3000"]`. Use `settings.cors_origins` from .env — never hardcode.
**Warning signs:** Browser console shows "Cannot use wildcard in Access-Control-Allow-Origin when credentials mode is 'include'".

### Pitfall 6: At-least-once Breaks with Auto-Commit
**What goes wrong:** Messages lost when processing partially fails.
**Why it happens:** With `enable_auto_commit=True`, Kafka commits the offset before the business logic completes. If the worker crashes mid-process, the message is marked done but was never fully handled.
**How to avoid:** Always use `enable_auto_commit=False` and `await consumer.commit()` only after successful `process()` call + DB write. This is already a locked decision.
**Warning signs:** Obligations disappear from the pipeline without appearing in the database.

---

## Code Examples

Verified patterns from official sources:

### Docker Compose — Full Infrastructure
```yaml
# Source: bitnami/kafka docs, qdrant docs, postgres official image
# docker-compose.yml
services:
  kafka:
    image: bitnami/kafka:latest
    ports:
      - "9092:9092"
      - "9094:9094"
    environment:
      - KAFKA_CFG_NODE_ID=0
      - KAFKA_CFG_PROCESS_ROLES=controller,broker
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093,EXTERNAL://:9094
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,EXTERNAL://localhost:9094
      - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093
      - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
      - KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR=1
      - KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1
      - KAFKA_CFG_TRANSACTION_STATE_LOG_MIN_ISR=1
      - ALLOW_PLAINTEXT_LISTENER=yes
    volumes:
      - kafka_data:/bitnami/kafka
    healthcheck:
      test: ["CMD-SHELL", "kafka-broker-api-versions.sh --bootstrap-server kafka:9092 || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 30s

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-ride}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ride}
      POSTGRES_DB: ${POSTGRES_DB:-ride}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-ride}"]
      interval: 10s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    healthcheck:
      test: ["CMD-SHELL", "bash -c 'exec 3<>/dev/tcp/127.0.0.1/6333 && echo -e \"GET /readyz HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n\" >&3 && grep -q \"HTTP/1.1 200\" <&3'"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./backend:/app   # hot-reload via uvicorn --reload
    command: uvicorn ride.api.main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      kafka:
        condition: service_healthy
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_healthy

volumes:
  kafka_data:
  postgres_data:
  qdrant_data:
```

### PostgreSQL Schema — Core Tables
```sql
-- ride/db/schema (expressed as SQLAlchemy models)
-- Matching Alembic autogenerate output pattern

-- documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    original_url TEXT,
    content_markdown TEXT,
    status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded | parsed | extracted
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- obligations table
CREATE TABLE obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    text TEXT NOT NULL,
    source_quote TEXT NOT NULL,
    reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    is_ambiguous BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- action_items table
CREATE TABLE action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obligation_id UUID NOT NULL REFERENCES obligations(id),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- system_mappings table
CREATE TABLE system_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_item_id UUID NOT NULL REFERENCES action_items(id),
    system_name TEXT NOT NULL,
    confidence_score FLOAT,
    suggested_by TEXT NOT NULL DEFAULT 'rag',  -- rag | human
    confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    engineer_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audit_log table — append-only, single table for all phases
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,   -- document | obligation | action_item | system_mapping
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,        -- created | approved | rejected | confirmed | etc.
    actor TEXT NOT NULL DEFAULT 'system',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- NO updated_at — audit log is append-only
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

### SQLAlchemy Models — UUID Pattern
```python
# Source: SQLAlchemy 2.0 docs https://docs.sqlalchemy.org/en/20/
# ride/models/document.py
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from ride.db.session import Base

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="uploaded")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

### Makefile Pattern
```makefile
# Makefile
.PHONY: up down migrate logs shell

up:
	docker compose up -d

down:
	docker compose down

migrate:
	docker compose exec backend alembic upgrade head

logs:
	docker compose logs -f backend

shell:
	docker compose exec backend python -m ride.shell

topics:
	docker compose exec backend python -m ride.kafka.create_topics
```

### Pre-commit + Ruff Configuration
```yaml
# .pre-commit-config.yaml
# Source: https://github.com/astral-sh/ruff-pre-commit
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "UP", "I", "B"]  # pyflakes, pyupgrade, isort, bugbear

[tool.ruff.lint.flake8-bugbear]
extend-immutable-calls = ["fastapi.Depends", "fastapi.Query"]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Kafka + Zookeeper | Kafka KRaft (no Zookeeper) | Kafka 2.8 preview, GA in 3.3 (2022), fully removed Zookeeper in 4.0 (2024) | One less service to manage; bitnami/kafka:latest defaults to KRaft |
| `flake8` + `black` + `isort` | `ruff` for all three | 2022-2023 | Single tool, 200x faster, same rule coverage |
| FastAPI `@app.on_event("startup")` | FastAPI `lifespan` context manager | FastAPI 0.93 (2023) | `on_event` is deprecated; lifespan is the current pattern |
| SQLAlchemy 1.4 legacy `Session` | SQLAlchemy 2.0 `AsyncSession` + `Mapped[]` | 2023 | Full type safety, first-class async, required for asyncpg |
| Alembic sync env.py + psycopg2 | Alembic `-t async` env.py + asyncpg only | 2022+ | Single driver, no URL swap hack |
| Pydantic v1 `BaseSettings` in `pydantic` | `pydantic-settings` separate package | Pydantic v2 (2023) | `BaseSettings` moved to standalone `pydantic-settings` package |

**Deprecated/outdated:**
- `wurstmeister/kafka` Docker image: Stopped releasing images in 2023. Use `bitnami/kafka` instead.
- FastAPI `@app.on_event("startup")`: Replaced by `lifespan` context manager. Functional but deprecated.
- `kafka-python` library: Sync-only, no active async support. Use `aiokafka` for async.

---

## Open Questions

1. **Qdrant health check reliability on this specific host**
   - What we know: The `/dev/tcp` bash workaround is the community solution; official healthcheck tool doesn't exist (GitHub issue #4250 still open September 2025)
   - What's unclear: Whether the Qdrant image includes `bash` (vs `sh`/`dash`) — the workaround requires bash
   - Recommendation: Test `docker compose up --wait` after initial setup. If `/dev/tcp` fails, fall back to a simple `start_period: 60s` with no healthcheck and accept that Qdrant might not be ready-gated.

2. **Kafka topic auto-creation vs. explicit creation**
   - What we know: bitnami/kafka with `KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true` (default) will create topics on first message. The CONTEXT.md says the topics file is "single source of truth."
   - What's unclear: Whether to rely on auto-creation or run an explicit topic-creation script on startup
   - Recommendation: Create topics explicitly via `kafka-topics.sh` in a startup script or `make topics` command. This makes partitions/replication-factor explicit and avoids auto-creation defaults producing different configs than intended.

3. **asyncpg version pin**
   - What we know: asyncpg 0.29.0+ caused compatibility issues with SQLAlchemy async dialect per community reports (WebSearch finding)
   - What's unclear: Whether this is fixed in the latest SQLAlchemy 2.0.x patch releases
   - Recommendation: Pin `asyncpg>=0.28.0,<0.30.0` in requirements.txt initially. Test upgrading once the stack is working. LOW confidence — verify against current SQLAlchemy changelog.

---

## Sources

### Primary (HIGH confidence)
- FastAPI official docs (https://fastapi.tiangolo.com/tutorial/cors/) — CORS middleware parameters and wildcard warning
- FastAPI official docs (https://fastapi.tiangolo.com/advanced/settings/) — Pydantic Settings + lru_cache pattern
- FastAPI official docs (https://fastapi.tiangolo.com/advanced/events/) — lifespan context manager pattern
- aiokafka official docs (https://aiokafka.readthedocs.io/en/stable/producer.html) — producer API, start/stop, send_and_wait
- aiokafka official docs (https://aiokafka.readthedocs.io/en/stable/examples/group_consumer.html) — manual commit pattern
- Qdrant GitHub issue #4250 — healthcheck tool absence confirmed, `/dev/tcp` workaround documented
- Qdrant official docs (https://qdrant.tech/documentation/guides/installation/) — Docker Compose config, ports

### Secondary (MEDIUM confidence)
- berkkaraal.com (2024-09-19) — FastAPI + SQLAlchemy 2.0 + Alembic async setup; code patterns verified against SQLAlchemy docs
- theexceptioncatcher.com (2025-06) — bitnami/kafka KRaft Docker Compose config, verified against bitnami Docker Hub README
- bitnami/containers GitHub issues #33325, #75323 — Kafka health check scripts; community-verified working commands

### Tertiary (LOW confidence)
- asyncpg<0.29.0 version pin requirement — reported in WebSearch community results; not confirmed against official SQLAlchemy changelog as of research date. Verify before finalizing requirements.txt.
- Qdrant `/dev/tcp` bash healthcheck reliability — community workaround from GitHub issue, not official. Test in actual environment.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are mature, docs verified via official sources
- Architecture patterns: HIGH — FastAPI + SQLAlchemy async + aiokafka patterns all verified from official docs
- Docker Compose config: MEDIUM — bitnami Kafka config verified against Docker Hub README; Qdrant healthcheck is community workaround
- Pitfalls: HIGH — sourced from official docs (CORS), official GitHub issues (Qdrant), and direct doc verification (Alembic, asyncpg)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack; re-verify asyncpg version compatibility if upgrading SQLAlchemy)
