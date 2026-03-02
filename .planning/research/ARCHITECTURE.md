# Architecture Research

**Domain:** Regulatory AI Document Processing Pipeline (Fintech)
**Researched:** 2026-03-02
**Confidence:** MEDIUM (stack is project-specified; patterns verified via official docs and multiple sources)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                           │
│                        Next.js Frontend App                           │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │  Upload/Ingest │  │  Legal Review  │  │  Engineering Review  │   │
│  │  Dashboard     │  │  Gate UI       │  │  Gate UI             │   │
│  └───────┬────────┘  └───────┬────────┘  └──────────┬───────────┘   │
│          │                  │                       │               │
│  ┌───────┴──────────────────┴───────────────────────┴───────────┐   │
│  │                   Impact Analysis View                        │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  HTTP/REST (polling or SSE)
┌──────────────────────────────▼───────────────────────────────────────┐
│                         API GATEWAY LAYER                             │
│                    FastAPI (Python) — /api/v1/*                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ /documents  │  │ /reviews     │  │ /mappings    │  │ /impacts │  │
│  │ POST upload │  │ POST approve │  │ POST confirm │  │ GET view │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────────┘  │
└─────────┼────────────────┼─────────────────┼──────────────────────────┘
          │  Kafka Produce  │  Kafka Produce  │  Kafka Produce
┌─────────▼────────────────▼─────────────────▼──────────────────────────┐
│                          MESSAGE BUS (Kafka)                           │
│                                                                        │
│  doc.ingested → doc.parsed → obligation.approved → action.generated   │
│                                          → mapping.confirmed           │
│  (each topic is a durable event log; consumers replay on restart)      │
└─────────┬────────────────┬────────────────┬───────────────────────────┘
          │                │                │
┌─────────▼──────┐  ┌──────▼──────┐  ┌─────▼──────────────────────────┐
│ INGESTION      │  │  AI ENGINE  │  │  RAG SYSTEM MAPPER             │
│ WORKER         │  │  WORKER     │  │  WORKER                        │
│                │  │             │  │                                │
│ pdfplumber/    │  │ Claude API  │  │ Claude API + Vector Store      │
│ httpx URL fetch│  │ structured  │  │ Chroma (embedded)              │
│ → raw text     │  │ output JSON │  │ → system suggestions          │
└─────────┬──────┘  └──────┬──────┘  └────────────────────────────────┘
          │                │
┌─────────▼────────────────▼─────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  PostgreSQL    │  │  Chroma      │  │  File Storage        │    │
│  │  (pipeline     │  │  (vector     │  │  (raw PDFs, URLs)    │    │
│  │   state, audit │  │   store for  │  │  local or S3-compat  │    │
│  │   records)     │  │   RAG docs)  │  │                      │    │
│  └────────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Next.js Frontend | UI for upload, review gates, impact view; polls or SSE for state changes | FastAPI via HTTP REST |
| FastAPI API Gateway | HTTP endpoints for all user actions; Kafka producer; state queries from DB | Frontend (HTTP), Kafka (produce), PostgreSQL (read/write) |
| Ingestion Worker | PDF text extraction, URL fetch, raw text normalization; publishes to `doc.ingested` | Kafka (consume `doc.uploaded`, produce `doc.ingested`) |
| AI Engine Worker | Calls Claude API for parsing, summarization, obligation extraction, action item generation; structured JSON output | Kafka (consume, produce), Claude API (HTTP), PostgreSQL (write) |
| RAG System Mapper Worker | Embeds action items, queries Chroma for matching internal service docs, produces suggestions | Kafka (consume, produce), Chroma (vector search), Claude API (rerank/synthesize) |
| PostgreSQL | Source of truth for document state, obligations, action items, review decisions, audit log | FastAPI, AI Worker, RAG Worker |
| Chroma (embedded) | Vector store for mock internal service documentation corpus; similarity search | RAG Worker only |
| Kafka | Durable async message bus decoupling pipeline stages; event log enables replay | All workers |

## Recommended Project Structure

```
ride/
├── frontend/                    # Next.js application
│   ├── app/                     # App Router pages
│   │   ├── (dashboard)/         # Main app layout
│   │   │   ├── upload/          # Document ingestion page
│   │   │   ├── review/          # Legal gate page
│   │   │   │   └── [docId]/
│   │   │   ├── engineering/     # Engineering gate page
│   │   │   │   └── [docId]/
│   │   │   └── impact/          # Final impact analysis page
│   │   │       └── [docId]/
│   │   └── layout.tsx
│   ├── components/              # Shared UI components
│   │   ├── obligation-card/     # Obligation display with citations
│   │   ├── pipeline-status/     # Visual pipeline stage indicator
│   │   ├── system-mapper/       # Engineering gate system list
│   │   └── impact-matrix/       # Final systems x obligations matrix
│   ├── lib/                     # API client, types, utilities
│   │   ├── api.ts               # FastAPI client (typed fetch wrappers)
│   │   └── types.ts             # Shared TypeScript types
│   └── next.config.ts           # Rewrites /api/py → Python backend
│
├── backend/                     # Python FastAPI + Workers
│   ├── api/                     # FastAPI application
│   │   ├── main.py              # App entrypoint, lifespan, CORS
│   │   ├── routes/              # Route handlers
│   │   │   ├── documents.py     # POST /documents/upload, GET /documents/{id}
│   │   │   ├── reviews.py       # POST /reviews/{obligationId}/approve
│   │   │   ├── mappings.py      # POST /mappings/{actionId}/confirm
│   │   │   └── impacts.py       # GET /impacts/{docId}
│   │   └── models/              # Pydantic models (request/response)
│   │       ├── document.py
│   │       ├── obligation.py
│   │       ├── action_item.py
│   │       └── mapping.py
│   │
│   ├── workers/                 # Kafka consumer workers
│   │   ├── ingestion_worker.py  # Consumes doc.uploaded, produces doc.ingested
│   │   ├── ai_worker.py         # Consumes doc.ingested, produces doc.parsed
│   │   ├── action_worker.py     # Consumes obligation.approved, produces action.generated
│   │   └── rag_worker.py        # Consumes action.generated, produces mapping.suggested
│   │
│   ├── services/                # Business logic (no Kafka, no HTTP)
│   │   ├── claude_service.py    # Claude API wrapper (parse, summarize, map)
│   │   ├── rag_service.py       # Chroma queries and embedding generation
│   │   ├── pdf_service.py       # pdfplumber text extraction
│   │   └── url_fetch_service.py # URL document retrieval
│   │
│   ├── kafka/                   # Kafka infrastructure
│   │   ├── producer.py          # Shared AIOProducer wrapper
│   │   ├── consumer.py          # Base consumer class with error handling
│   │   └── topics.py            # Topic name constants
│   │
│   ├── db/                      # Database layer
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── session.py           # Async session factory
│   │   └── migrations/          # Alembic migrations
│   │
│   └── rag/                     # RAG corpus and indexing
│       ├── corpus/              # Mock internal service docs (markdown/JSON)
│       │   ├── kyc_service.md
│       │   ├── trading_engine.md
│       │   ├── tax_reporting.md
│       │   └── ...
│       └── indexer.py           # Corpus ingestion into Chroma at startup
│
└── docker-compose.yml           # Kafka, Zookeeper, PostgreSQL, all workers
```

### Structure Rationale

- **`workers/` separate from `api/`:** Workers run as separate processes; they do not share the HTTP server's event loop. Each worker is its own long-running asyncio process consuming from Kafka.
- **`services/` isolated from transport:** Claude API, PDF, and RAG logic have no Kafka or HTTP dependencies. This makes unit testing trivial and allows swapping transport without touching business logic.
- **`kafka/topics.py` as single source of truth:** Topic name constants shared across producers and consumers prevent string drift bugs.
- **`rag/corpus/`:** Static mock docs committed to the repo. Indexer runs at startup to populate Chroma. If Chroma is reset, indexer re-populates. No manual setup required.

## Architectural Patterns

### Pattern 1: Topic-Per-Pipeline-Stage (One Topic Per State Transition)

**What:** Each handoff between pipeline stages is its own Kafka topic. The topic name describes the event that occurred, not the command being issued.

**When to use:** Always for this pipeline. One topic per stage gives you independent consumer groups, dead-letter queues per stage, and replay from any point.

**Kafka Topic Design:**

```
ride.doc.uploaded          → Ingestion Worker consumes
ride.doc.ingested          → AI Engine Worker consumes
ride.doc.parsed            → API writes to DB; frontend polls state
ride.obligation.approved   → (after Legal Gate) Action Worker consumes
ride.action.generated      → RAG Mapper Worker consumes
ride.mapping.suggested     → (after Engineering Gate) API writes to DB
ride.mapping.confirmed     → Final state; Impact Analysis ready
```

**Topic naming convention:** `{service}.{entity}.{past-tense-event}`

**Example producer (FastAPI at Legal Gate approval):**

```python
# In FastAPI route: POST /reviews/{obligation_id}/approve
async def approve_obligation(obligation_id: str, priority: str):
    await db.update_obligation_status(obligation_id, "approved", priority)
    await producer.produce(
        topic=Topics.OBLIGATION_APPROVED,
        key=obligation_id,
        value={"obligation_id": obligation_id, "priority": priority, "approved_at": utcnow()}
    )
    return {"status": "approved"}
```

**Trade-offs:** More topics to manage, but the granularity is worth it — each stage can fail and retry independently without re-running upstream stages.

### Pattern 2: Approval Gate as State Machine with Kafka as Transition Log

**What:** Each document moves through discrete states. Human gates are blocking states — the pipeline halts until a human acts. Kafka events log the transition, not the command to transition.

**When to use:** Any human-in-the-loop workflow where audit trail matters.

**State machine:**

```
UPLOADED
  → INGESTING (worker picks up)
  → INGESTED (raw text extracted)
  → PARSING (AI worker processing)
  → PARSED (obligations extracted, citations attached)
  → AWAITING_LEGAL (blocking — legal gate open)    ← HUMAN GATE 1
  → LEGAL_APPROVED (legal approves, sets priority)
  → GENERATING_ACTIONS (AI worker transforms to action items)
  → ACTIONS_GENERATED
  → AWAITING_ENGINEERING (blocking — eng gate open) ← HUMAN GATE 2
  → ENGINEERING_CONFIRMED (engineer confirms/corrects systems)
  → COMPLETE (impact analysis ready)
```

**State is stored in PostgreSQL, not Kafka.** Kafka carries transition events. Frontend polls PostgreSQL (via FastAPI) for current state. This is critical: Kafka is not a database — do not query it for current state.

**Trade-offs:** Polling adds latency. For a demo, 2-second polling intervals are acceptable. Production would use SSE or WebSockets pushed from FastAPI on Kafka consumption.

### Pattern 3: RAG Architecture for System Mapping

**What:** Each action item gets embedded, then Chroma finds the most semantically similar mock internal service documents. Claude synthesizes the matches into ranked system suggestions with rationale.

**When to use:** Any time you need to map unstructured content to a known catalogue (regulations to systems, requirements to teams, etc.).

**RAG Data Flow:**

```
Action Item Text
     ↓
text-embedding-3-small (via Claude or OpenAI) → float[1536]
     ↓
Chroma similarity_search(top_k=5)
     ↓
[KYC Service doc, Trading Engine doc, Tax Reporting doc ...]
     ↓
Claude prompt: "Given this action item and these service descriptions,
               which services are affected and why?"
     ↓
Structured JSON: { systems: [{name, rationale, confidence}] }
     ↓
Written to PostgreSQL as draft mapping
     ↓
Engineering Gate UI surfaces these suggestions for confirmation
```

**Corpus indexing at startup:**

```python
# backend/rag/indexer.py
def index_corpus(chroma_client, corpus_dir: Path):
    collection = chroma_client.get_or_create_collection("internal_services")
    if collection.count() > 0:
        return  # Already indexed — idempotent
    for doc_path in corpus_dir.glob("*.md"):
        text = doc_path.read_text()
        collection.add(
            documents=[text],
            ids=[doc_path.stem],
            metadatas=[{"service_name": doc_path.stem}]
        )
```

**Trade-offs:** Chroma embedded (in-process, no server) is correct for a prototype with ~10-20 service documents. Do not use a hosted vector DB (Pinecone, Qdrant) for this scale — it adds network latency and cost without benefit.

### Pattern 4: Claude Structured Outputs for Parsing

**What:** Use Claude's native structured outputs (public beta as of Nov 2025) to guarantee JSON schema compliance. No retry logic, no output parsing heuristics.

**When to use:** Always when Claude's output feeds into database writes or downstream pipeline stages.

**Example schema for obligation extraction:**

```python
from pydantic import BaseModel
from typing import List

class Citation(BaseModel):
    text: str
    page_number: int | None

class Obligation(BaseModel):
    title: str
    summary: str
    obligation_type: str  # "disclosure", "reporting", "operational", "capital"
    citations: List[Citation]
    ai_reasoning: str     # Transparent — shown in UI

class ParsedDocument(BaseModel):
    document_title: str
    regulatory_body: str
    effective_date: str | None
    obligations: List[Obligation]
    overall_summary: str
```

**Beta header required:** `anthropic-beta: structured-outputs-2025-11-13`

**Trade-offs:** Beta feature — pin the SDK version and test thoroughly. Eliminates an entire class of parsing bugs that would otherwise require retry loops.

## Data Flow

### Primary Pipeline Flow (Happy Path)

```
User uploads PDF
     ↓ HTTP POST /documents/upload
FastAPI saves file → writes doc record (UPLOADED) → produces ride.doc.uploaded
     ↓ Kafka
Ingestion Worker consumes → pdfplumber extracts text → writes raw text to DB
     → produces ride.doc.ingested
     ↓ Kafka
AI Engine Worker consumes → Claude API (structured output):
     - parse obligations with citations
     - attach ai_reasoning to each obligation
     → writes obligations to DB (doc state: PARSED, AWAITING_LEGAL)
     → produces ride.doc.parsed

[LEGAL GATE OPEN — Frontend polls, shows AWAITING_LEGAL state]

Legal reviewer clicks Approve on obligation with priority
     ↓ HTTP POST /reviews/{obligationId}/approve
FastAPI updates obligation → produces ride.obligation.approved
     ↓ Kafka
Action Worker consumes → Claude API:
     - transforms obligation into 1-N action items
     - each action has owner (Legal/Eng/Product), deadline type
     → writes action items to DB
     → produces ride.action.generated
     ↓ Kafka
RAG Worker consumes → embed action item → Chroma search → Claude synthesis
     → writes draft mapping to DB (doc state: AWAITING_ENGINEERING)
     → produces ride.mapping.suggested

[ENGINEERING GATE OPEN — Frontend polls, shows AWAITING_ENGINEERING state]

Engineer confirms/corrects system mapping
     ↓ HTTP POST /mappings/{actionId}/confirm
FastAPI updates mapping → produces ride.mapping.confirmed
     → when all actions confirmed: doc state = COMPLETE
     ↓
Impact Analysis view available: systems × obligations matrix
```

### Frontend State Polling

```
Next.js (every 2s)
     ↓ GET /documents/{id}/status
FastAPI reads PostgreSQL doc state
     ↓
Returns { state: "AWAITING_LEGAL", obligations: [...] }
     ↓
UI routes to correct gate view or shows pipeline progress indicator
```

### Key Data Flows

1. **Document state authority:** PostgreSQL owns current state. Kafka carries events. Never derive state from Kafka offsets.
2. **AI output persistence:** All Claude API responses written to DB before producing next Kafka event. If worker crashes after writing but before producing, the API layer can re-trigger by re-publishing for that doc ID.
3. **RAG query scope:** Chroma is queried per action item, not per document. This allows multi-system mapping where different obligations affect different services.
4. **Human gate audit trail:** Every approve/confirm HTTP call writes a `reviewer_id`, `timestamp`, and `comment` to an audit table before producing the Kafka event. Audit is non-negotiable — it must survive the pipeline.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API | HTTP via `anthropic` Python SDK; async; structured outputs beta | Pin SDK version; use `anthropic-beta: structured-outputs-2025-11-13` header |
| Kafka | `confluent-kafka` Python with asyncio via `AIOProducer`; workers run in dedicated asyncio loops | FastAPI uses lifespan events for producer init/shutdown |
| PostgreSQL | `asyncpg` via SQLAlchemy async sessions; Alembic for migrations | All DB writes are async; never block FastAPI event loop |
| Chroma | Embedded (in-process), no server; Python `chromadb` client | Initialize once at startup in RAG worker; corpus indexed at first run |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ FastAPI | REST HTTP (JSON); polling every 2s for state | Consider SSE for production; polling is sufficient for demo |
| FastAPI ↔ Kafka | confluent-kafka AIOProducer; non-blocking produce with callback | Produce events after DB writes succeed, never before |
| Workers ↔ Kafka | confluent-kafka consumer; one worker process per consumer group | Each worker has its own consumer group ID — parallel processing |
| Workers ↔ PostgreSQL | Shared async connection pool; SQLAlchemy async | Workers and API share the same DB schema |
| Workers ↔ Claude API | Synchronous HTTP inside async worker loop; use `asyncio.to_thread` if blocking | Anthropic SDK is sync; wrap in `asyncio.to_thread` for async workers |
| RAG Worker ↔ Chroma | In-process call; zero network latency | Must be in same process as RAG worker — not accessible from FastAPI directly |

## Suggested Build Order (Dependencies Drive This)

Building in this order avoids hitting blockers from unbuilt dependencies:

```
Phase 1: Data Models + DB Schema
  → Define PostgreSQL tables (documents, obligations, action_items, mappings, audit)
  → Define Pydantic request/response models
  → Reason: Everything depends on the schema; build it first or refactor constantly

Phase 2: Kafka Infrastructure
  → Topic creation, producer wrapper, base consumer class
  → Reason: Workers can't be built without this foundation

Phase 3: Ingestion Pipeline (Upload → Parsed)
  → FastAPI upload endpoint
  → Ingestion Worker (PDF + URL)
  → AI Engine Worker (Claude parsing)
  → Reason: This is the entry point; validate Claude structured outputs here before
    building downstream consumers

Phase 4: RAG Corpus + Vector Store
  → Ingest mock service docs into Chroma
  → Build RAG query logic
  → Reason: RAG Worker depends on corpus; build and test retrieval independently
    before wiring into Kafka

Phase 5: Legal Gate (First Human Gate)
  → FastAPI approve/reject endpoint
  → Action Worker (obligation → action items)
  → Frontend Legal Review UI
  → Reason: Unlocks the second half of the pipeline

Phase 6: Engineering Gate + RAG Worker (Second Human Gate)
  → RAG Mapper Worker (action items → system suggestions)
  → FastAPI confirm/correct endpoint
  → Frontend Engineering Review UI
  → Reason: RAG Worker is the most complex; build gate UI before wiring it so
    you can test with hardcoded suggestions first

Phase 7: Impact Analysis View
  → Final read-only view of systems × obligations matrix
  → Reason: Pure read from DB; no new infra required

Phase 8: Polish + Demo Preparation
  → Pipeline progress indicator in UI
  → Architecture diagrams
  → Audit trail UI
```

## Anti-Patterns

### Anti-Pattern 1: Treating Kafka as a Database

**What people do:** Query Kafka topics for "current document state" by reading messages, or use message count to determine pipeline progress.

**Why it's wrong:** Kafka is an event log, not a queryable store. Re-reading from offset 0 is expensive and non-trivial to query for a specific document's latest state across multiple topics.

**Do this instead:** Write all state transitions to PostgreSQL. Kafka carries the events that trigger transitions. Frontend reads state from PostgreSQL via FastAPI.

### Anti-Pattern 2: Blocking the FastAPI Event Loop with Claude API Calls

**What people do:** Call the Claude API directly in a FastAPI route handler (synchronous Anthropic SDK call in an async route).

**Why it's wrong:** The Anthropic Python SDK is synchronous. Calling it directly in an async route blocks the entire event loop, freezing all other requests during the ~5-15 second Claude response time.

**Do this instead:** Claude calls happen only inside workers, not in FastAPI route handlers. FastAPI only produces Kafka events and reads from DB. Workers are separate processes with their own event loops — blocking is acceptable there. If you must call Claude from FastAPI (e.g., for synchronous demo UX), use `asyncio.to_thread(claude_call, ...)`.

### Anti-Pattern 3: Chroma Shared Between FastAPI and Workers

**What people do:** Initialize Chroma in `main.py` and access it from both the FastAPI process and worker processes.

**Why it's wrong:** ChromaDB embedded mode is not safe for concurrent access from multiple processes (it uses SQLite internally). Multiple writers will corrupt the collection.

**Do this instead:** Chroma lives only in the RAG Worker process. FastAPI does not touch Chroma directly. The RAG Worker is the only reader/writer.

### Anti-Pattern 4: Skipping the Audit Trail Until "Later"

**What people do:** Build the happy path first, plan to add audit logs "once it works."

**Why it's wrong:** Audit records must be written in the same transaction as state updates. Adding them later means retrofitting the DB schema, potentially losing existing records, and rewriting all gate endpoints.

**Do this instead:** Add the audit table and write audit records from the first gate endpoint you build. It takes 5 lines of code upfront and avoids a painful retrofit.

### Anti-Pattern 5: One Kafka Consumer for the Whole Pipeline

**What people do:** Build a single consumer that handles all topics and branches on event type.

**Why it's wrong:** One consumer means one failure point. If the RAG step fails, retrying it re-runs ingestion. Scaling one step means scaling all steps. The stages are not equally expensive (Claude calls take 5-15s; text extraction takes <1s).

**Do this instead:** One worker process per pipeline stage, each with its own consumer group. Stages scale and fail independently.

## Scaling Considerations

This is a prototype, not a production system. The table is included to demonstrate systems thinking for the portfolio, not because RIDE needs to scale.

| Concern | Prototype (1 user, demo) | Production (1K regs/day) | At Scale (10K regs/day) |
|---------|--------------------------|--------------------------|-------------------------|
| Claude API latency | Synchronous in worker; ~5-15s per call is fine | Queue depth monitoring; retry with exponential backoff | Multiple worker processes; rate limit aware scheduler |
| Chroma performance | Embedded, 10-20 docs; sub-10ms retrieval | Switch to Chroma server mode or pgvector for concurrent access | Dedicated vector DB (Qdrant or Weaviate); sharding by regulatory domain |
| Kafka throughput | Single broker, no replication needed | Replicated topics (RF=3); consumer lag monitoring | Partitioned topics; horizontal worker scaling |
| PostgreSQL | Single instance; no connection pooling needed | PgBouncer + read replica for reporting queries | Partitioned tables by document date; caching layer |
| State polling | 2s polling from frontend is fine | Switch to SSE (FastAPI EventSourceResponse) | WebSocket with per-session subscriptions |

## Sources

- [Apache Kafka Architecture 2025 — Instaclustr](https://www.instaclustr.com/education/apache-kafka/apache-kafka-architecture-a-complete-guide-2025/)
- [Event Sourcing with Kafka — Confluent](https://www.confluent.io/blog/event-sourcing-using-apache-kafka/)
- [Asynchronous Kafka Consumption with FastAPI — Webmobix/Medium](https://medium.com/webmobix/asynchronous-kafka-consumption-with-confluent-and-fastapi-4262746d7f56)
- [Kafka Python AsyncIO Integration — Confluent Blog](https://www.confluent.io/blog/kafka-python-asyncio-integration/)
- [Anthropic Claude Structured Outputs — Official Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Human-in-the-Loop Workflows — Orkes](https://orkes.io/blog/human-in-the-loop/)
- [RAG System Design: Vector Databases to API Endpoints — CustomGPT](https://customgpt.ai/rag-system-design/)
- [Chroma vs pgvector — Zilliz Comparison](https://zilliz.com/comparison/chroma-vs-pgvector)
- [Next.js + FastAPI Full-Stack Architecture — Vintasoftware](https://vintasoftware.github.io/nextjs-fastapi-template/)
- [PDF Extraction Libraries Python 2025 — DEV Community](https://dev.to/onlyoneaman/i-tested-7-python-pdf-extractors-so-you-dont-have-to-2025-edition-akm)

---
*Architecture research for: RIDE — Regulatory AI Document Processing Pipeline (Fintech)*
*Researched: 2026-03-02*
