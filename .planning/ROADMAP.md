# Roadmap: RIDE

## Overview

RIDE transforms financial regulatory documents into approved, system-mapped business action items through a transparent AI pipeline with two human-in-the-loop gates. The build follows a hard dependency chain: infrastructure and schema must exist before workers, ingestion and extraction must produce obligations before the legal gate can review them, legal approval must produce action items before the RAG mapper can suggest systems, and RAG suggestions must exist before the engineering gate can confirm them. Four phases deliver this pipeline end-to-end, compressing naturally around the two HITL gates as delivery boundaries.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - PostgreSQL schema, Kafka backbone, FastAPI scaffold, and Docker Compose infrastructure
- [x] **Phase 2: Ingestion and Extraction** - PDF upload, structure-preserving parsing, and AI obligation extraction with citations and reasoning
- [ ] **Phase 3: Legal Gate, Action Items, and RAG Corpus** - Legal review gate, obligation-to-action-item transformation, and RAG system mapper with mock service corpus
- [ ] **Phase 4: Engineering Gate, Impact Matrix, and Demo** - Engineering review gate, systems-x-obligations matrix, architecture diagrams, and demo-ready end-to-end flow

## Phase Details

### Phase 1: Foundation
**Goal**: Infrastructure is live and the pipeline skeleton exists — schema, Kafka topics, and workers can be wired in without structural rework
**Depends on**: Nothing (first phase)
**Requirements**: None directly (enabler phase — all downstream requirements depend on this foundation)
**Success Criteria** (what must be TRUE):
  1. Docker Compose starts cleanly with Kafka (KRaft, no Zookeeper), PostgreSQL, and Qdrant — all healthy
  2. FastAPI application starts, health check endpoint responds, and CORS is configured for the Next.js frontend
  3. PostgreSQL schema is created with tables for documents, obligations, action items, mappings, and audit log
  4. Kafka topics file is the single source of truth and all 8 topic names resolve without hardcoded strings in worker code
  5. A dead-letter queue pattern exists and producer/consumer base classes are importable by all workers
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold, Docker Compose infrastructure, FastAPI health endpoint
- [x] 01-02-PLAN.md — Kafka topic registry, base producer/consumer classes, SQLAlchemy models, Alembic migration

### Phase 2: Ingestion and Extraction
**Goal**: A regulatory PDF uploaded by the user produces structured obligations with verbatim source quotes, chain-of-thought reasoning, and ambiguity flags — visible in the database and ready for legal review
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-02, EXTRACT-01, EXTRACT-02, EXTRACT-03
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF regulatory document via the frontend and the file is accepted
  2. The parsed document preserves tables and section headings as Markdown (not flat text) — verifiable by inspecting the parsed output
  3. Each extracted obligation has a verbatim source quote from the original document visible alongside the AI summary
  4. Each extracted obligation displays its chain-of-thought reasoning so the reviewer can see why the obligation was identified
  5. Obligations flagged as ambiguous are visually distinct from clear obligations in the UI
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — PDF upload endpoint, structure-preserving parse worker, Docker uploads volume, and FastAPI lifespan wiring
- [x] 02-02-PLAN.md — Pydantic extraction schema, Claude structured output extract worker, chunking with deduplication, and obligation persistence

### Phase 3: Legal Gate, Action Items, and RAG Corpus
**Goal**: A legal reviewer can approve or reject obligations with full evidence displayed, approved obligations become structured action items, and the RAG system mapper has a working mock corpus ready for suggestions
**Depends on**: Phase 2
**Requirements**: LEGAL-01, LEGAL-02, ACTION-01, RAG-01, RAG-02
**Success Criteria** (what must be TRUE):
  1. Legal reviewer can approve or reject each obligation with the verbatim source quote displayed side-by-side — no approve/reject without evidence visible
  2. Every approve and reject action is recorded in the audit log in the same database transaction as the state update
  3. Approved obligations are automatically transformed into structured business action items with owner and deadline fields
  4. The RAG system mapper returns system suggestions for an action item using the mock Wealthsimple service corpus (KYC, Trading Engine, Tax Reporting, Compliance Reporting, Auth, Notifications)
  5. Mock service corpus is committed to the repository and indexed at startup — retrieval precision exceeds 80% on test obligation queries
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Legal review API with atomic audit logging, action item worker, RAG corpus + indexer, RAG mapper worker, and full lifespan wiring
- [ ] 03-02-PLAN.md — Next.js 15 frontend with Wealthsimple-inspired design, document list page, and legal review split-panel UI with obligation cards

### Phase 4: Engineering Gate, Impact Matrix, and Demo
**Goal**: Engineers can confirm or correct AI system suggestions with RAG evidence displayed, the final systems-x-obligations matrix reflects all confirmed mappings, architecture diagrams exist, and one polished end-to-end flow is demo-ready
**Depends on**: Phase 3
**Requirements**: ENG-01, ENG-02, IMPACT-01, ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. Engineer can confirm, correct, or reassign each AI-suggested system mapping — with the RAG retrieval evidence (which service doc chunks matched) displayed per suggestion
  2. Engineer override of a system mapping is logged with the reason to the audit trail
  3. The final impact analysis view shows a systems-x-obligations matrix where confirmed mappings (including overrides) are reflected — not just the AI's initial suggestions
  4. Architecture diagrams exist showing the event-driven pipeline design and the two human-in-the-loop gates
  5. One complete regulatory document flows through the full pipeline — upload to impact matrix — without errors, producing a result suitable for the 2-3 minute demo video
**Plans**: TBD

Plans:
- [ ] 04-01: Engineering review gate API and UI with RAG evidence display
- [ ] 04-02: Impact analysis matrix view, architecture diagrams, and demo validation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete   | 2026-03-02 |
| 2. Ingestion and Extraction | 2/2 | Complete | 2026-03-03 |
| 3. Legal Gate, Action Items, and RAG Corpus | 0/2 | Not started | - |
| 4. Engineering Gate, Impact Matrix, and Demo | 0/2 | Not started | - |
