# Stack Research

**Domain:** Regulatory AI document processing pipeline with RAG, human-in-the-loop gates, async messaging
**Project:** RIDE (Regulatory Integrated Development Environment)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH (core choices HIGH; embedding model selection MEDIUM; Kafka-to-frontend bridge pattern MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (stable) / 16.x (available) | Frontend framework, dashboard UI, SSE bridge | App Router with Server Components gives legal/engineering dashboards fast initial loads and clean data-fetching patterns. 15.x is battle-tested; 16.x available but introduces React 19.2 breaking changes — hold at 15.x for prototype stability. |
| Python | 3.12 | Backend runtime | FastAPI + async ecosystem requires 3.11+; 3.12 is current stable with measurable async performance improvements. |
| FastAPI | 0.115.x | Python API server | De-facto standard for async Python APIs in 2025-2026. Native async def, Pydantic v2 integration, auto OpenAPI docs. Runs under Uvicorn workers. Use it as the bridge between Kafka consumers and the Next.js frontend via Server-Sent Events. |
| Anthropic Python SDK | 0.84.0 | Claude API access | Official SDK, actively developed (released Feb 25, 2026). Provides sync and async clients, type definitions for all request/response fields, and first-class support for structured outputs via `output_config.format`. |
| Apache Kafka | Existing constraint | Async pipeline messaging | Prescribed by project. Each pipeline stage (ingest → parse → legal gate → RAG → engineering gate) publishes to a topic; downstream consumers process independently. Decouples AI processing latency from UI responsiveness. |
| confluent-kafka | 2.13.0 | Python Kafka client | Production-grade, built on librdkafka (C library). Outperforms kafka-python and aiokafka for throughput and reliability. Latest release Jan 5, 2026. Use for both producers (ingest stage, RAG stage) and consumers (FastAPI workers). |
| Qdrant | 1.17.x (server) | Vector database for RAG system mapper | Purpose-built, Rust-based, production-proven. Runs in Docker for local dev. Python client (`qdrant-client` 1.17.0, released Feb 19, 2026) has full async support. Preferred over ChromaDB (not production-hardened) and pgvector (no dedicated vector indexing at this scale). |
| pymupdf4llm | 0.3.4 | PDF → Markdown extraction for LLM ingestion | Best-in-class extraction for RAG pipelines. Extracts text, tables, headers with structure-preserving Markdown output. Supports Level 3 chunking. Released Feb 14, 2026. Note AGPL license (acceptable for prototype; flag for production). |
| LlamaIndex (llama-index-core) | 0.14.15 | RAG orchestration — indexing, chunking, retrieval | Specialized for data indexing and retrieval (vs. LangChain which is broader pipeline orchestration). 40% faster retrieval than LangChain in benchmarks. Native pymupdf4llm integration. Released Feb 18, 2026. |
| Tailwind CSS | 4.x | Utility-first CSS | v4 released Jan 22, 2025. CSS-first config (no tailwind.config.js needed). 3-10x faster full builds, 100x faster incremental. Standard pairing with shadcn/ui. |
| shadcn/ui | Latest (CLI-based) | UI component library | Not a dependency — components are copied into your project, giving full ownership. Built on Radix UI primitives (accessibility) + Tailwind. The dominant professional dashboard component library in 2025-2026. Used in legal/fintech dashboards. Works with Next.js 15 App Router. |

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfplumber | 0.11.9 | Fallback PDF table extraction | Use when pymupdf4llm misses complex tabular data in regulatory PDFs (dense structured tables, e.g., CSA fee schedules). Coordinate-based extraction with visual debugging. Released Jan 5, 2026. |
| pydantic | 2.x | Data validation and schema enforcement | Already a FastAPI dependency. Use for defining obligation schemas, action item schemas, system mapping output schemas. Integrates with Claude structured output validation. |
| sentence-transformers | 3.x | Local embedding generation for RAG | Use `all-mpnet-base-v2` (768-dim, strong semantic search, no API costs). Alternative to calling OpenAI/Cohere for embeddings — keeps RAG self-contained for prototype. |
| Radix UI | Bundled via shadcn/ui | Accessible UI primitives | Underpins all shadcn/ui components. Use directly only when needing headless primitives not yet in shadcn. |
| Recharts / shadcn Charts | Latest | Data visualization in dashboards | Built into shadcn/ui as the chart primitive. Use for systems x action items matrix visualization in final impact view. |
| python-dotenv | 1.x | Environment variable management | Load `ANTHROPIC_API_KEY`, Kafka bootstrap servers, Qdrant connection string from `.env` in Python backend. |
| uvicorn | 0.34.x | ASGI server for FastAPI | Production deployment: `uvicorn[standard]` with multiple workers. Handles async connections efficiently. |
| httpx | 0.28.x | Async HTTP client | Use for any outbound HTTP calls from FastAPI (e.g., document URL fetch on ingest). Already a dependency of the Anthropic SDK. |
| Zod | 3.x | Runtime schema validation in Next.js | Validate API response shapes on the frontend before rendering. Pairs with TypeScript for end-to-end type safety. |
| Zustand | 5.x | Lightweight frontend state management | Simpler than Redux for managing pipeline state (current document, gate status, system mapping selections) in Next.js app. No boilerplate. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose | Local Kafka + Qdrant orchestration | Run Kafka (with KRaft mode — no Zookeeper), Qdrant, and optionally the Python backend as containers. Single `docker-compose up` for full local stack. |
| uv | Python package manager | Significantly faster than pip/poetry. Install: `pip install uv`, then `uv pip install ...`. Increasingly standard in Python ML/AI projects in 2025. |
| TypeScript | 5.x | Type safety across Next.js frontend | Essential for professional dashboard — prevents runtime errors in gate workflow components. |
| ESLint + Prettier | Latest | Next.js code quality | shadcn/ui scaffolding includes these by default. |
| Ruff | Latest | Python linting and formatting | Rust-based, replaces flake8 + black + isort. Single tool for all Python code quality. |

---

## Installation

```bash
# --- Python Backend ---
# Install uv first (fast package manager)
pip install uv

# Python backend packages
uv pip install \
  fastapi==0.115.x \
  uvicorn[standard] \
  anthropic==0.84.0 \
  pymupdf4llm==0.3.4 \
  pdfplumber==0.11.9 \
  llama-index-core==0.14.15 \
  llama-index-vector-stores-qdrant \
  qdrant-client==1.17.0 \
  "qdrant-client[fastembed]" \
  confluent-kafka==2.13.0 \
  sentence-transformers \
  pydantic \
  python-dotenv \
  httpx

# --- Next.js Frontend ---
npx create-next-app@latest ride-frontend \
  --typescript --tailwind --app --eslint

cd ride-frontend

# Initialize shadcn/ui (interactive setup — choose slate theme, CSS variables)
npx shadcn@latest init

# Add dashboard-critical components
npx shadcn@latest add \
  button card table badge dialog sheet \
  tabs separator progress skeleton \
  dropdown-menu popover tooltip \
  form input label textarea select \
  chart

# State management
npm install zustand

# Runtime schema validation
npm install zod

# Dev dependencies (if not included by create-next-app)
npm install -D typescript @types/node @types/react
```

```yaml
# docker-compose.yml (local dev)
version: "3.8"
services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
    ports:
      - "9092:9092"

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage
```

---

## Claude API Structured Output Pattern

This is the critical pattern for RIDE — regulatory document parsing must return validated, structured JSON.

**Use `output_config.format` with `json_schema`** (GA as of late 2025 on Claude Opus 4.6, Sonnet 4.6, Haiku 4.5):

```python
import anthropic
import json

client = anthropic.Anthropic()

OBLIGATION_SCHEMA = {
    "type": "object",
    "properties": {
        "obligations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "requirement_text": {"type": "string"},
                    "citation": {"type": "string"},
                    "deadline": {"type": ["string", "null"]},
                    "priority": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "affected_parties": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["id", "title", "summary", "requirement_text", "citation", "priority"],
                "additionalProperties": False
            }
        },
        "document_metadata": {
            "type": "object",
            "properties": {
                "regulator": {"type": "string"},
                "effective_date": {"type": ["string", "null"]},
                "document_type": {"type": "string"}
            },
            "required": ["regulator", "document_type"],
            "additionalProperties": False
        }
    },
    "required": ["obligations", "document_metadata"],
    "additionalProperties": False
}

response = client.messages.create(
    model="claude-sonnet-4-6",  # Use Sonnet for document analysis (cost/performance balance)
    max_tokens=4096,
    messages=[{"role": "user", "content": document_markdown}],
    system="You are a regulatory compliance analyst...",
    output_config={
        "format": {
            "type": "json_schema",
            "schema": OBLIGATION_SCHEMA
        }
    }
)

obligations = json.loads(response.content[0].text)
```

**Key insight:** The schema is cached for 24 hours. Zero Data Retention applies to structured output requests — compliance-friendly for financial data.

---

## Kafka Topic Design for RIDE Pipeline

```
ride.documents.ingested        → Raw PDF bytes + metadata
ride.documents.parsed          → Extracted Markdown + pymupdf4llm output
ride.obligations.extracted     → Claude-structured obligations (pre-legal gate)
ride.obligations.approved      → Legal-approved obligations (post-gate)
ride.actions.generated         → Business action items
ride.mappings.suggested        → RAG-suggested system mappings (pre-engineering gate)
ride.mappings.confirmed        → Engineering-confirmed system mappings (post-gate)
ride.pipeline.status           → Pipeline stage events (for SSE to frontend)
```

**Frontend real-time pattern:** FastAPI consumes `ride.pipeline.status` and exposes a `/events` SSE endpoint. Next.js frontend subscribes with `EventSource` API. This avoids WebSocket complexity for a prototype where updates are unidirectional (server → client).

```python
# FastAPI SSE bridge
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from confluent_kafka import Consumer
import asyncio
import json

@app.get("/api/pipeline/{document_id}/events")
async def pipeline_events(document_id: str):
    async def event_stream():
        consumer = Consumer({
            "bootstrap.servers": "localhost:9092",
            "group.id": f"sse-{document_id}",
            "auto.offset.reset": "latest"
        })
        consumer.subscribe(["ride.pipeline.status"])
        try:
            while True:
                msg = consumer.poll(timeout=0.1)
                if msg and not msg.error():
                    yield f"data: {msg.value().decode()}\n\n"
                await asyncio.sleep(0.05)
        finally:
            consumer.close()
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pymupdf4llm | pdfplumber only | When table extraction is the primary goal and you need MIT license; pymupdf4llm is better for LLM pipelines but carries AGPL |
| pymupdf4llm | pypdf (MIT) | Only if AGPL is a hard blocker; pypdf has simpler extraction without LLM-optimized formatting |
| Qdrant | ChromaDB | Prototype-only, no production scale — ChromaDB is faster to set up but not production-hardened |
| Qdrant | pgvector | If you already have PostgreSQL and vectors < 1M; adds complexity for prototype with no benefit |
| LlamaIndex | LangChain | When you need multi-step agent orchestration; for pure RAG retrieval, LlamaIndex is cleaner |
| confluent-kafka | aiokafka | If FastAPI is purely async and simplicity matters more than throughput; aiokafka is asyncio-native but less battle-tested |
| sentence-transformers | Cohere Embed v3 / OpenAI text-3-large | When higher MTEB scores matter and API cost is acceptable; Cohere embed-v4 leads benchmarks at 65.2 MTEB |
| shadcn/ui | Tremor | If the primary view is charts/analytics; Tremor excels at data visualization dashboards but has less general component coverage |
| SSE (Server-Sent Events) | WebSockets | WebSockets when bidirectional real-time interaction is needed; RIDE gates are form-submit + display, so SSE suffices |
| Next.js 15 | Next.js 16 | Once React 19.2 ecosystem stabilizes; 16 available now but introduces async API breaking changes |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| PyPDF2 | Officially deprecated since 2023, no longer maintained | pypdf (its successor) or pymupdf4llm for LLM pipelines |
| kafka-python | Minimal maintenance, performance substantially worse than confluent-kafka; uses pure Python network I/O | confluent-kafka (librdkafka-backed) |
| aiokafka alone | Asyncio-native but lacks confluent-kafka's maturity, connection handling, and librdkafka optimization | confluent-kafka with asyncio integration via thread pools or AIOProducer |
| ChromaDB in production | Lightweight and fast for prototyping but explicitly not designed for multi-tenant, regulated, or high-volume production | Qdrant (same Python interface, production-grade) |
| Redux / Redux Toolkit | Overkill for this prototype — heavy boilerplate, slow to develop with | Zustand (lighter, simpler, sufficient for pipeline state) |
| Tailwind CSS v3 | v4 released Jan 2025, shadcn/ui now targets v4, v3 will diverge from ecosystem | Tailwind CSS v4 |
| Material UI (MUI) | Opinionated Google Material Design — wrong aesthetic for professional legal/fintech dashboards (compare Harvey AI) | shadcn/ui (unstyled, you own the design) |
| LangChain for pure RAG | Heavier, more complex than needed when the task is document indexing + retrieval; 40% slower retrieval | LlamaIndex for indexing/retrieval layer |
| Direct PDF bytes to Claude | Wastes context window on unstructured bytes; Claude does not have PDF-native understanding equivalent to purpose-built parsers | pymupdf4llm → Markdown → Claude |

---

## Stack Patterns by Variant

**For the regulatory document ingestion worker (Python):**
- Use `pymupdf4llm.to_markdown()` on uploaded PDF
- Publish Markdown + metadata to `ride.documents.parsed` Kafka topic
- Keep this worker stateless — no database writes, pure transform-and-publish

**For the Claude obligation extraction worker (Python):**
- Consume from `ride.documents.parsed`
- Call Claude with `output_config.format.type = "json_schema"` and the obligation schema
- Publish structured JSON to `ride.obligations.extracted`
- Use `claude-sonnet-4-6` model — cost/quality balance for document analysis

**For the RAG system mapper (Python):**
- Consume approved obligations from `ride.obligations.approved`
- Use LlamaIndex `VectorStoreIndex` backed by Qdrant
- Embed mock service documentation (KYC Service, Trading Engine, Tax Reporting, etc.) at startup
- For each obligation, retrieve top-K relevant services and publish suggested mappings

**For the FastAPI gateway:**
- Expose REST endpoints for gate actions (legal approve/reject, engineering confirm/correct)
- Produce Kafka events on gate decisions
- Expose SSE `/events` stream consuming `ride.pipeline.status`
- Validate all incoming/outgoing data with Pydantic schemas

**For Next.js dashboard UI:**
- Use App Router with Server Components for data fetching at each gate view
- Client components only for interactive elements (approve/reject buttons, system mapping checkboxes)
- `EventSource` hook on client side subscribes to FastAPI SSE endpoint for live pipeline updates
- shadcn/ui `Table` component for obligations list, `Card` for obligation detail, `Dialog` for approval forms

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pymupdf4llm 0.3.4 | Python 3.9-3.12 | Requires PyMuPDF >= 1.24; pulls in PyMuPDF automatically |
| llama-index-core 0.14.15 | Python 3.8+; pydantic 2.x | Install `llama-index-vector-stores-qdrant` for Qdrant integration |
| qdrant-client 1.17.0 | Python 3.8+; asyncio | Use `qdrant-client[fastembed]` for automatic embeddings without separate sentence-transformers install |
| confluent-kafka 2.13.0 | Python 3.8+; librdkafka 2.13.0 | Bundled librdkafka on most platforms; no separate C install required |
| anthropic 0.84.0 | Python 3.7+ | Structured outputs (output_config.format) require this SDK version; old beta header deprecated |
| shadcn/ui | Next.js 14+, React 18+, Tailwind 4.x | Use `npx shadcn@latest init` — do NOT use old `shadcn-ui` package name |
| Next.js 15 | React 18 or 19 | App Router default; Turbopack stable in dev since 15.x |
| Tailwind CSS 4.x | Next.js 15+, PostCSS | CSS-first config — no tailwind.config.js needed; shadcn/ui CLI handles Tailwind v4 setup automatically |

---

## License Notes for Prototype

PyMuPDF / pymupdf4llm uses AGPL-3.0. For this prototype:
- **Acceptable:** Open-source project, portfolio demo, internal demo — AGPL does not apply to closed usage
- **Flag for production:** Any server-deployed product serving external users must either open-source all code under AGPL or purchase an Artifex commercial license
- **Alternative if AGPL is a hard block from day one:** Use `pdfplumber` (MIT) + `pypdf` (BSD) for extraction, accepting lower quality Markdown output for LLM prompts

---

## Sources

- [PyPI: pymupdf4llm 0.3.4](https://pypi.org/project/pymupdf4llm/) — version confirmed Feb 14, 2026 (HIGH confidence)
- [PyMuPDF4LLM official docs](https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/) — LLM extraction features (HIGH confidence)
- [PyPI: pdfplumber 0.11.9](https://pypi.org/project/pdfplumber/) — version confirmed Jan 5, 2026 (HIGH confidence)
- [PyPI: confluent-kafka 2.13.0](https://pypi.org/project/confluent-kafka/) — version confirmed Jan 5, 2026 (HIGH confidence)
- [Confluent Python Kafka Docs](https://docs.confluent.io/kafka-clients/python/current/overview.html) — asyncio integration pattern (HIGH confidence)
- [PyPI: qdrant-client 1.17.0](https://pypi.org/project/qdrant-client/) — version confirmed Feb 19, 2026 (HIGH confidence)
- [PyPI: anthropic 0.84.0](https://github.com/anthropics/anthropic-sdk-python/releases) — version confirmed Feb 25, 2026 (HIGH confidence)
- [Claude Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — output_config.format parameter, model support, ZDR policy (HIGH confidence — official Anthropic docs)
- [PyPI: llama-index 0.14.15](https://pypi.org/project/llama-index/) — version confirmed Feb 18, 2026 (HIGH confidence)
- [LangChain vs LlamaIndex 2025](https://latenode.com/blog/langchain-vs-llamaindex-2025-complete-rag-framework-comparison) — retrieval performance comparison (MEDIUM confidence — single source)
- [Firecrawl: Best Vector Databases 2026](https://www.firecrawl.dev/blog/best-vector-databases) — Qdrant vs alternatives (MEDIUM confidence)
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — official install instructions (HIGH confidence)
- [Next.js 15 release blog](https://nextjs.org/blog/next-15) — App Router, React 19, version status (HIGH confidence)
- [Tailwind CSS v4 release](https://dev.to/darshan_bajgain/setting-up-2025-nextjs-15-with-shadcn-tailwind-css-v4-no-config-needed-dark-mode-5kl) — v4 CSS-first config with shadcn (MEDIUM confidence)
- [Artifex AGPL licensing](https://artifex.com/licensing) — PyMuPDF commercial license requirements (HIGH confidence)
- [Kafka + SSE pattern](https://medium.com/@sureshdotariya/connecting-next-js-16-with-kafka-websockets-event-driven-architecture-real-time-at-scale-49363ec1a51b) — Kafka to frontend real-time patterns (MEDIUM confidence)
- [Best embedding models 2025](https://www.zenml.io/blog/best-embedding-models-for-rag) — sentence-transformers vs Cohere vs OpenAI (MEDIUM confidence)

---

*Stack research for: Regulatory AI document processing pipeline with RAG*
*Researched: 2026-03-02*
