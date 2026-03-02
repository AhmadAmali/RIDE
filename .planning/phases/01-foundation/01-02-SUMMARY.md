---
phase: 01-foundation
plan: 02
subsystem: pipeline-skeleton
tags: [kafka, sqlalchemy, alembic, postgresql, aiokafka, strenum, uuid, orm, migrations]

# Dependency graph
requires:
  - 01-01 (FastAPI app, async SQLAlchemy engine + Base, Pydantic Settings, kafka/__init__.py stub)
provides:
  - KafkaTopic StrEnum with 16 members (8 primary + 8 DLQ) as single source of truth
  - BaseProducer with JSON serialization via AIOKafkaProducer.send_and_wait
  - BaseConsumer ABC with manual commit, automatic DLQ routing, full error envelope
  - create_topics.py script (runnable as python -m ride.kafka.create_topics)
  - 5 SQLAlchemy ORM models: Document, Obligation, ActionItem, SystemMapping, AuditLog
  - Alembic async migration environment (env.py reads settings.database_url, imports all models)
affects:
  - 02-pipeline (workers subclass BaseConsumer, import KafkaTopic, use ORM models)
  - 03-legal-gate
  - 04-engineering-gate

# Tech tracking
tech-stack:
  added:
    - aiokafka AIOKafkaProducer / AIOKafkaConsumer / AIOKafkaAdminClient (kafka module)
    - sqlalchemy.dialects.postgresql.JSONB (audit_log metadata)
    - alembic async template (env.py with async_engine_from_config, NullPool)
    - StrEnum (Python 3.11+ built-in, used for KafkaTopic)
  patterns:
    - "Pattern: KafkaTopic StrEnum — topic name is the value; ALL_TOPICS = list(KafkaTopic) as single source"
    - "Pattern: BaseConsumer — manual commit after process() success; DLQ send + commit on exception"
    - "Pattern: Alembic env.py — sys.path.insert for ride.* imports; from ride.models import * before target_metadata"
    - "Pattern: AuditLog append-only — no updated_at, JSONB metadata_, two indexes for entity lookup and time range"
    - "Pattern: UUID mapped_column — default=uuid.uuid4, no server-side generation needed"

key-files:
  created:
    - backend/ride/kafka/topics.py
    - backend/ride/kafka/producer.py
    - backend/ride/kafka/consumer.py
    - backend/ride/kafka/create_topics.py
    - backend/ride/models/document.py
    - backend/ride/models/obligation.py
    - backend/ride/models/action_item.py
    - backend/ride/models/system_mapping.py
    - backend/ride/models/audit_log.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/script.py.mako
    - backend/alembic/versions/.gitkeep
  modified:
    - backend/ride/kafka/__init__.py
    - backend/ride/models/__init__.py

key-decisions:
  - "KafkaTopic StrEnum derives DLQ topic via KafkaTopic(str(primary_topic) + '.dlq') — no separate lookup table needed"
  - "BaseConsumer commits offset after DLQ send (not before) to guarantee at-least-once semantics even if DLQ write fails"
  - "AuditLog uses mapped_column('metadata', JSONB) with Python attribute metadata_ to avoid reserved word conflict"
  - "Alembic env.py uses sys.path.insert (not PYTHONPATH) for portability inside Docker container"
  - "Kafka image switched from bitnami/kafka to apache/kafka:3.9.2 — bitnami removed from Docker Hub"

# Metrics
duration: ~3min
completed: 2026-03-02
---

# Phase 1 Plan 02: Pipeline Skeleton Summary

**Kafka topic registry (16-member StrEnum), BaseProducer/BaseConsumer with DLQ routing, and 5 async SQLAlchemy ORM models with Alembic async migration environment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T22:51:20Z
- **Completed:** 2026-03-02T22:54:16Z
- **Tasks:** 3 of 3 completed (Task 3 human-verify checkpoint: APPROVED — all 8 steps passed)
- **Files modified:** 16

## Accomplishments

- KafkaTopic StrEnum with 16 members: 8 primary topics (ride.document.uploaded through ride.impact.matrix.ready) plus 8 matching DLQ topics with .dlq suffix
- BaseProducer with JSON serialization — send(topic: KafkaTopic, message: dict) serializes via json.dumps and calls send_and_wait
- BaseConsumer ABC with at-least-once delivery — manual commit after process() success; on exception sends full error envelope to DLQ topic then commits to avoid infinite retry
- create_topics.py creates all topics from ALL_TOPICS list using AIOKafkaAdminClient; handles TopicAlreadyExistsError gracefully; runnable as python -m ride.kafka.create_topics
- 5 SQLAlchemy ORM models: Document, Obligation, ActionItem, SystemMapping, AuditLog — all with UUID v4 primary keys and snake_case columns
- FK chain enforced at DB level: documents <- obligations <- action_items <- system_mappings
- AuditLog is append-only (no updated_at), uses JSONB for metadata_, indexed on (entity_type, entity_id) and (created_at)
- Alembic async env.py: sys.path.insert for ride imports, from ride.models import * registers all models with Base.metadata, overrides sqlalchemy.url from settings.database_url

## Task Commits

Each task was committed atomically:

1. **Task 1: Kafka topic registry and base producer/consumer** - `9378523` (feat)
2. **Task 2: SQLAlchemy ORM models and Alembic async migration** - `457f575` (feat)
3. **Task 3: Verify complete Phase 1 infrastructure end-to-end** - human-verify checkpoint APPROVED (all 8 steps passed)

**Deviation fix:** `1dd985a` — switch Kafka image from bitnami/kafka to apache/kafka:3.9.2 (bitnami removed from Docker Hub)

**Plan metadata:** Committed with SUMMARY.md (docs)

## Files Created/Modified

- `backend/ride/kafka/topics.py` - KafkaTopic StrEnum (16 members) + ALL_TOPICS list
- `backend/ride/kafka/producer.py` - BaseProducer with start/stop/send lifecycle
- `backend/ride/kafka/consumer.py` - BaseConsumer ABC with manual commit, DLQ routing, error envelope
- `backend/ride/kafka/create_topics.py` - Admin client script, TopicAlreadyExistsError handling, __main__ block
- `backend/ride/kafka/__init__.py` - Exports KafkaTopic, ALL_TOPICS, BaseProducer, BaseConsumer
- `backend/ride/models/document.py` - Document model: id(UUID), filename, original_url, content_markdown, status, uploaded_at, updated_at
- `backend/ride/models/obligation.py` - Obligation model: id(UUID), document_id(FK), text, source_quote, reasoning, status, is_ambiguous
- `backend/ride/models/action_item.py` - ActionItem model: id(UUID), obligation_id(FK), description, owner, deadline, status
- `backend/ride/models/system_mapping.py` - SystemMapping model: id(UUID), action_item_id(FK), system_name, confidence_score, suggested_by, confirmed, engineer_note
- `backend/ride/models/audit_log.py` - AuditLog model: id(UUID), entity_type, entity_id(UUID no FK), action, actor, metadata_(JSONB), created_at; indexes on entity lookup and created_at
- `backend/ride/models/__init__.py` - Imports all 5 models for Alembic autogenerate
- `backend/alembic.ini` - Alembic config (sqlalchemy.url empty, overridden in env.py)
- `backend/alembic/env.py` - Async env: sys.path fix, star import models, Base.metadata, settings.database_url override
- `backend/alembic/script.py.mako` - Mako template for generated migration files
- `backend/alembic/versions/.gitkeep` - Tracks empty versions directory in git
- `docker-compose.yml` - Kafka image updated from bitnami/kafka to apache/kafka:3.9.2

## Decisions Made

- DLQ topic derivation: `KafkaTopic(str(topic) + ".dlq")` — works because StrEnum values follow the pattern `ride.*.dlq`
- BaseConsumer commits offset after DLQ send (not before) to guarantee at-least-once semantics — if the DLQ write itself fails, the message will be re-consumed
- AuditLog `metadata_` attribute maps to `"metadata"` column name to avoid Python keyword conflict
- Alembic env.py uses `sys.path.insert(0, ...)` so ride imports work both locally and in Docker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ruff UP017: timezone.utc -> datetime.UTC in consumer.py**
- **Found during:** Task 1 verification (ruff check)
- **Issue:** `datetime.now(tz=timezone.utc)` flagged by UP017 rule (Python 3.11+ prefers `datetime.UTC` alias)
- **Fix:** `ruff --fix` auto-corrected to `datetime.now(tz=UTC)` with updated import
- **Files modified:** `backend/ride/kafka/consumer.py`
- **Commit:** `9378523`

**2. [Rule 1 - Bug] Ruff I001: unsorted imports in alembic/env.py**
- **Found during:** Task 2 verification (ruff check)
- **Issue:** Import order violated isort rules (alembic after sqlalchemy, E402 noqa needed)
- **Fix:** `ruff --fix` sorted imports correctly
- **Files modified:** `backend/alembic/env.py`
- **Commit:** `457f575`

**3. [Rule 1 - Bug] Switched Kafka Docker image from bitnami/kafka to apache/kafka:3.9.2**
- **Found during:** Task 3 (end-to-end verification — `make up`)
- **Issue:** bitnami/kafka image removed from Docker Hub; `docker compose up` failed to pull image
- **Fix:** Updated docker-compose.yml Kafka service image to `apache/kafka:3.9.2` (official Apache Kafka image, KRaft mode)
- **Files modified:** `docker-compose.yml`
- **Verification:** `docker compose ps` showed all 4 services healthy; all 8 human verification steps passed
- **Commit:** `1dd985a`

---

**Total deviations:** 3 auto-fixed (2 linting / Rule 1, 1 blocking infrastructure / Rule 1)
**Impact on plan:** All auto-fixes necessary for correctness. Kafka image substitution is functionally transparent — same KRaft single-node behavior.

## Issues Encountered

- Host system has Python 3.6.9 (not 3.11), so the plan's `python -c "from ride.kafka.topics import KafkaTopic..."` verification could not run on the host. AST-based structural verification was performed instead: file parsing, content assertions, and ruff linting. The code is Python 3.11 targeting Docker runtime and will work correctly there.
- alembic binary not available on host (Python 3.6.9 environment). The `alembic init -t async alembic` command was replicated manually using the standard async template. The generated migration (`alembic revision --autogenerate -m "initial schema"`) was run during Task 3 Docker verification via `make migrate`.
- bitnami/kafka image removed from Docker Hub between plan creation and execution — resolved by switching to official Apache Kafka 3.9.2 image.

## Next Phase Readiness

- Full Phase 1 infrastructure verified end-to-end: Docker Compose, PostgreSQL (5 tables), Kafka (16 topics), FastAPI health endpoint
- Phase 2 workers can immediately subclass BaseConsumer, import KafkaTopic, and define ORM models — no structural rework needed
- Alembic migration baseline established; future schema changes use `alembic revision --autogenerate`
- Blockers for Phase 2: Demo regulatory document must be selected; Claude structured output schema needs Workbench validation before writing extraction worker

## Self-Check: PASSED

All 16 expected files found on disk. All task commits verified in git history (9378523, 457f575, 1dd985a). Task 3 human-verify checkpoint approved by user — all 8 end-to-end verification steps passed.

---
*Phase: 01-foundation*
*Completed: 2026-03-02*
