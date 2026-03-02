# Phase 1: Foundation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Infrastructure is live and the pipeline skeleton exists — Docker Compose with Kafka (KRaft), PostgreSQL, and Qdrant all healthy; FastAPI scaffold with health check and CORS; PostgreSQL schema for documents, obligations, action items, mappings, and audit log; Kafka topics file as single source of truth for all 8 topics; dead-letter queue pattern with producer/consumer base classes importable by all workers.

</domain>

<decisions>
## Implementation Decisions

### Database schema design
- UUID v4 for all primary keys — globally unique, safe for event-driven pipeline
- snake_case column naming — PostgreSQL convention, matches Python
- Dedicated audit_log table with entity_type, entity_id, action, actor, timestamp, metadata JSON — single table for all phases
- Alembic for migrations — version-controlled schema changes with rollback support, paired with SQLAlchemy

### Kafka topic architecture
- Domain-prefixed naming: ride.document.uploaded, ride.obligation.extracted, etc. — clear pipeline stages
- JSON serialization — human-readable, no schema registry needed, appropriate for prototype scope
- Per-topic DLQ: each topic gets a .dlq counterpart (e.g., ride.obligation.extracted.dlq) with error metadata
- Manual offset commit after successful processing + DB write — at-least-once delivery guarantee

### Project layout
- Single Python package (ride/) with modules: api/, workers/, models/, kafka/, db/ — workers import shared code directly
- Sibling directories at root: backend/ and frontend/ — Docker Compose orchestrates both, shared .env at root
- SQLAlchemy 2.0 + asyncpg for database access — async-native, type-safe models, pairs with Alembic
- Pydantic Settings for configuration — reads .env with type validation, single Settings class

### Dev workflow
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

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- Docker Compose will orchestrate all services
- FastAPI serves as the API gateway for the Next.js frontend
- Kafka connects all pipeline workers
- PostgreSQL is the shared data store

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-02*
