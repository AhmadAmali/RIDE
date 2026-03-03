# Phase 03: Legal Gate, Action Items, and RAG Corpus - Research

**Researched:** 2026-03-02
**Domain:** FastAPI review API / Next.js 15 split-panel UI / Qdrant + FastEmbed RAG / SQLAlchemy atomic transactions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Legal Review Experience:** Split panel layout — left shows original document Markdown, right shows extracted obligations as interactive cards with approve/reject actions. No approve/reject without evidence visible.
- **Obligation card shows:** AI summary, verbatim source quote (highlighted/indented), chain-of-thought reasoning, ambiguity badge if flagged.
- **One-at-a-time review per obligation** — no batch approve/reject for v1 (compliance accountability).
- **Audit log entry in the SAME database transaction as the status update** — no state change without audit trail.
- **`is_ambiguous` obligations visually distinct** (badge or color treatment) for extra reviewer attention.
- **Design Language — Wealthsimple-Inspired:** Clean, minimal aesthetic with generous whitespace. Sans-serif typography, card-based components with subtle shadows, muted professional palette (deep teal/navy primary, white backgrounds). Large prominent approve/reject buttons.
- **Service Selection — Multi-Select:** When RAG suggests affected systems, reviewer can multi-select. UI presents suggestions as selectable chips or checkboxes.
- **Action Item Generation:** Triggered automatically when obligation is approved — `OBLIGATION_APPROVED` Kafka event → worker generates action item. Claude generates a structured business action item description (substantive transformation, not copy). Owner and deadline fields NULL for now. One action item per approved obligation.
- **Mock Corpus Design:** 6 mock Wealthsimple services: KYC, Trading Engine, Tax Reporting, Compliance Reporting, Auth, Notifications. Each service gets a realistic markdown doc (~500-1000 words). Committed to repo under `data/corpus/`. Indexed into Qdrant at startup. Chunked and embedded for semantic search.
- **RAG Suggestion Behavior:** Return top 3 system suggestions per action item, ranked by confidence. Show all results above 0.5 confidence threshold. Empty suggestions if nothing above threshold. Each stored as `SystemMapping` record with `suggested_by="rag"` and `confirmed=False`.

### Claude's Discretion
- Frontend framework choice (React, Next.js, etc.) and component library
- Embedding model selection for corpus indexing
- Exact Qdrant collection configuration (distance metric, vector dimensions)
- Chunk size for corpus documents
- Specific color hex values and spacing tokens matching Wealthsimple aesthetic
- Action item prompt engineering for quality descriptions

### Deferred Ideas (OUT OF SCOPE)
- Batch approve/reject — future enhancement after v1 validates one-at-a-time review
- Priority/severity classification on obligations (LEGAL-03) — v2 requirement
- Real-time updates via SSE (PIPE-02) — v2 requirement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEGAL-01 | Legal/compliance reviewer can approve or reject each extracted obligation with source quotes displayed | FastAPI PATCH endpoint on obligation; Next.js split-panel UI with shadcn/ui Resizable + Card; SQLAlchemy atomic transaction commits obligation status + AuditLog row together |
| LEGAL-02 | Every approve/reject action is logged to an immutable audit trail | AuditLog model already exists; must insert AuditLog in same `async with session.begin()` block as Obligation status update — single commit = atomicity |
| ACTION-01 | Approved obligations are transformed into structured business action items | `ActionItemWorker` subclasses `BaseConsumer`, consumes `OBLIGATION_APPROVED`, calls Claude structured output to generate `ActionItem.description`, persists `ActionItem`, emits `ACTION_ITEM_GENERATED` |
| RAG-01 | System suggests affected internal systems using RAG against mock Wealthsimple service documentation | `RagMapperWorker` consumes `ACTION_ITEM_GENERATED`, embeds action item text via FastEmbed, queries Qdrant collection, stores top-3 results above 0.5 threshold as `SystemMapping` rows |
| RAG-02 | Mock service corpus includes realistic services (KYC, Trading Engine, Tax Reporting, etc.) | 6 markdown files under `data/corpus/`, loaded and indexed into Qdrant at FastAPI lifespan startup; idempotent via `collection_exists()` check |
</phase_requirements>

---

## Summary

Phase 3 has three distinct technical domains that must work together: (1) a FastAPI legal review API with atomic audit logging, (2) a Next.js 15 frontend with a polished split-panel layout, and (3) a Qdrant RAG pipeline fed by a mock corpus of 6 Wealthsimple service documents.

The backend is well-established. The existing `BaseConsumer`/`BaseProducer` pattern, `Obligation`/`ActionItem`/`SystemMapping`/`AuditLog` models, and Kafka topics (`OBLIGATION_APPROVED`, `ACTION_ITEM_GENERATED`) are all in place. The two new workers follow the exact same pattern as `ExtractWorker`. The key constraint is that the obligation status update and audit log insert must occur in the same database transaction — this is straightforward with SQLAlchemy's `async with session.begin()` context manager.

The frontend is brand new. The project already has a `frontend/` directory (empty) and `cors_origins` set to `["http://localhost:3000"]`. Next.js 15 with shadcn/ui is the correct choice: it provides a `Resizable` split-panel component out of the box, a fintech-quality card system, and `react-markdown` handles the left-panel document rendering. The Wealthsimple-inspired design is achievable with shadcn's slate/teal color tokens and Tailwind utility classes.

For RAG, `qdrant-client` v1.17.0 with the `[fastembed]` extra is the standard stack. The `AsyncQdrantClient.add()` method (inherited from `AsyncQdrantFastembedMixin`) handles embedding and upsert in a single call using BAAI/bge-small-en-v1.5 (384 dimensions, cosine distance). Startup indexing is idempotent via `collection_exists()` check before `create_collection()`.

**Primary recommendation:** Use Next.js 15 + shadcn/ui for frontend, `qdrant-client[fastembed]` with BAAI/bge-small-en-v1.5 for RAG, and SQLAlchemy `async with session.begin()` for atomic audit logging.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Frontend framework with App Router | SSR + client components, CORS-already-handled via proxy optional, TypeScript first-class, standard for FastAPI frontends in 2025 |
| shadcn/ui | latest | Component library | Ships `Resizable` (split panels), `Card`, `Badge`, `Button`; copies components into codebase (no runtime dep); Tailwind-based — directly customizable |
| react-markdown | 9.x | Render document Markdown in left panel | Safe, customizable, prose-compatible; standard React markdown renderer |
| @tailwindcss/typography | 0.5.x | Style rendered Markdown with `prose` class | One class makes markdown readable without custom CSS |
| qdrant-client | 1.17.0 | Python async client for Qdrant vector DB | Official client; `AsyncQdrantClient` with `[fastembed]` extra handles embedding + upsert in one call |
| fastembed (via qdrant-client extra) | bundled | ONNX-based local embedding, no GPU required | Faster than sentence-transformers on CPU; BAAI/bge-small-en-v1.5 is 384-dim, 80%+ retrieval on standard benchmarks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | via shadcn | Underlying resizable panel primitive | Implicitly used; don't import directly — use shadcn's `Resizable` wrapper |
| @types/react | latest | TypeScript defs for React | Always — TypeScript project |
| Tailwind CSS v4 | v4 | Utility CSS (already in stack assumption) | All layout, spacing, color |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BAAI/bge-small-en-v1.5 (384-dim) | sentence-transformers/all-MiniLM-L6-v2 (384-dim) | Both 384-dim, cosine; bge-small is the FastEmbed default and faster via ONNX; all-MiniLM-L6-v2 requires sentence-transformers package (heavier) |
| Next.js 15 | Create React App / Vite + React | Next.js is already implied by `cors_origins: ["http://localhost:3000"]` and is the current standard; CRA is deprecated |
| shadcn/ui Resizable | CSS grid / custom flex split | Resizable panels with drag handles require react-resizable-panels; shadcn wraps it cleanly; don't hand-roll |

**Installation (backend additions):**
```bash
pip install "qdrant-client[fastembed]"
```

**Installation (frontend bootstrap):**
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir
cd frontend
npx shadcn@latest init
npx shadcn@latest add resizable card badge button scroll-area separator
npm install react-markdown @tailwindcss/typography
```

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/                          # NEW — Next.js 15 App Router
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with fonts/globals
│   │   ├── page.tsx               # Document list / upload redirect
│   │   └── review/
│   │       └── [documentId]/
│   │           └── page.tsx       # Legal review split-panel page
│   ├── components/
│   │   ├── review/
│   │   │   ├── ReviewPanel.tsx    # Orchestrates split layout
│   │   │   ├── DocumentPanel.tsx  # Left: markdown render
│   │   │   └── ObligationCard.tsx # Right: single obligation card
│   │   └── ui/                    # shadcn copied components
│   └── lib/
│       └── api.ts                 # Typed fetch wrappers to backend

backend/ride/
├── api/routes/
│   └── obligations.py             # NEW: PATCH approve/reject, GET list
├── workers/
│   ├── action_item_worker.py      # NEW: OBLIGATION_APPROVED consumer
│   └── rag_mapper_worker.py       # NEW: ACTION_ITEM_GENERATED consumer
├── rag/
│   └── corpus_indexer.py          # NEW: startup Qdrant indexing
└── schemas/
    └── action_item.py             # NEW: ActionItemOutput Pydantic schema

data/
└── corpus/                        # NEW: 6 mock service markdown files
    ├── kyc.md
    ├── trading_engine.md
    ├── tax_reporting.md
    ├── compliance_reporting.md
    ├── auth.md
    └── notifications.md
```

### Pattern 1: Atomic Obligation Review with Audit Log

**What:** Update obligation status AND insert audit log row in a single database transaction so neither can succeed without the other.

**When to use:** Every approve/reject action — LEGAL-02 requires audit log in same transaction.

```python
# Source: SQLAlchemy 2.0 async docs — session.begin() context manager
async def _review_obligation(
    db: AsyncSession, obligation_id: uuid.UUID, action: str, actor: str
) -> Obligation:
    async with db.begin():
        result = await db.execute(
            select(Obligation).where(Obligation.id == obligation_id)
        )
        obligation = result.scalar_one_or_404()

        if obligation.status != "pending":
            raise HTTPException(status_code=409, detail="Obligation already reviewed")

        obligation.status = action  # "approved" or "rejected"

        audit_entry = AuditLog(
            entity_type="obligation",
            entity_id=obligation_id,
            action=action,
            actor=actor,
            metadata_={"previous_status": "pending"},
        )
        db.add(audit_entry)
        # Commit happens on __aexit__ — both rows land or neither does
    return obligation
```

**Key:** `async with db.begin()` ensures both the obligation update and audit log insert land in the same commit. Do NOT commit separately.

### Pattern 2: Action Item Worker (BaseConsumer subclass)

**What:** Consume `OBLIGATION_APPROVED`, call Claude structured output, persist `ActionItem`, emit `ACTION_ITEM_GENERATED`.

**When to use:** Follows identical pattern to `ExtractWorker`.

```python
# Pattern: identical to ExtractWorker — subclass BaseConsumer
class ActionItemWorker(BaseConsumer):
    def __init__(self) -> None:
        super().__init__(KafkaTopic.OBLIGATION_APPROVED, group_id="action-item-worker")
        self._emit_producer = BaseProducer()
        self._client = Anthropic(api_key=settings.anthropic_api_key)

    async def process(self, message: dict) -> None:
        obligation_id = message["obligation_id"]
        # Fetch obligation, generate description via Claude, persist ActionItem
        # Emit ACTION_ITEM_GENERATED
```

### Pattern 3: RAG Corpus Indexer (startup, idempotent)

**What:** At FastAPI lifespan startup, load 6 markdown files from `data/corpus/`, chunk them, embed and index into Qdrant. Idempotent — safe to call on every restart.

**When to use:** Called once in the lifespan `startup` block.

```python
# Source: qdrant-client docs — AsyncQdrantClient + fastembed mixin
from qdrant_client import AsyncQdrantClient, models

COLLECTION_NAME = "wealthsimple_services"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"  # 384 dimensions, cosine

async def index_corpus(client: AsyncQdrantClient, corpus_dir: str) -> None:
    # Idempotent: skip if already indexed
    if await client.collection_exists(COLLECTION_NAME):
        return

    # Create collection — let fastembed mixin set vector params
    vector_params = client.get_fastembed_vector_params()
    await client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=vector_params,
    )

    # Load and chunk markdown files
    documents: list[str] = []
    payloads: list[dict] = []
    for path in Path(corpus_dir).glob("*.md"):
        text = path.read_text()
        for chunk in _chunk_text(text, chunk_chars=800):
            documents.append(chunk)
            payloads.append({"service": path.stem, "source_file": path.name})

    # add() handles embedding + upsert in one call
    await client.add(
        collection_name=COLLECTION_NAME,
        documents=documents,
        metadata=payloads,
    )
```

### Pattern 4: RAG Mapper Worker

**What:** Consume `ACTION_ITEM_GENERATED`, query Qdrant with action item description, store top-3 results above 0.5 threshold as `SystemMapping` rows.

```python
async def _query_and_store(self, action_item_id: uuid.UUID, description: str) -> None:
    results = await self._qdrant.query(
        collection_name=COLLECTION_NAME,
        query_text=description,
        limit=3,
    )
    # Filter by confidence threshold
    above_threshold = [r for r in results if r.score >= 0.5]

    async with async_session_maker() as session:
        for result in above_threshold:
            mapping = SystemMapping(
                action_item_id=action_item_id,
                system_name=result.metadata.get("service", "unknown"),
                confidence_score=result.score,
                suggested_by="rag",
                confirmed=False,
            )
            session.add(mapping)
        await session.commit()
```

### Pattern 5: Next.js Split Panel Layout

**What:** shadcn/ui `ResizablePanelGroup` wrapping left (document markdown) and right (obligation cards) panels.

```tsx
// Source: shadcn/ui resizable docs — ui.shadcn.com/docs/components/radix/resizable
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import ReactMarkdown from "react-markdown"

export function ReviewPanel({ markdown, obligations }) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-screen">
      <ResizablePanel defaultSize={50} minSize={30}>
        {/* Left: Document markdown with prose styling */}
        <ScrollArea className="h-full p-6">
          <ReactMarkdown className="prose prose-slate max-w-none">
            {markdown}
          </ReactMarkdown>
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30}>
        {/* Right: Obligation cards */}
        <ScrollArea className="h-full p-6 space-y-4">
          {obligations.map(ob => <ObligationCard key={ob.id} obligation={ob} />)}
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
```

### Anti-Patterns to Avoid

- **Separate audit log commit:** Never do `await session.commit()` after obligation update, then `await session.commit()` again for audit. If the process crashes between commits, state diverges from audit log. Use `async with session.begin()` for both.
- **Synchronous Qdrant in async FastAPI:** `QdrantClient` (sync) will block the event loop. Always use `AsyncQdrantClient`.
- **Collection recreation on every startup:** Check `collection_exists()` first. Recreating drops all indexed data.
- **Batch approve on frontend:** The UX must require reviewing the source quote before acting. No "approve all" button.
- **`react-markdown` without sanitization awareness:** react-markdown v9 does not execute scripts by default; this is safe. Do not add `rehype-raw` unless confirmed safe content.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split panels | Custom CSS flex drag logic | `shadcn/ui Resizable` (wraps react-resizable-panels) | Touch support, keyboard accessibility, persistence — dozens of edge cases |
| Text embedding | Custom embedding calls to OpenAI/Anthropic | `qdrant-client[fastembed]` with BAAI/bge-small-en-v1.5 | FastEmbed is ONNX-based, runs locally without API keys, already bundled with qdrant-client |
| Vector similarity search | SQL cosine similarity | Qdrant `AsyncQdrantClient.query()` | Qdrant handles HNSW indexing, approximate nearest neighbor, scoring — SQL cosine is O(n) full scan |
| Markdown rendering | Custom HTML parser | `react-markdown` + `@tailwindcss/typography` | Handles all CommonMark edge cases, XSS-safe by default |

**Key insight:** The entire RAG embedding pipeline (text → vector → index → search) is abstracted into `client.add(documents, metadata)` and `client.query(query_text)`. Do not manually call embedding models.

---

## Common Pitfalls

### Pitfall 1: Obligation Status / Audit Log Split Transaction
**What goes wrong:** Developer does `obligation.status = "approved"; await session.commit()` then creates AuditLog in a separate commit. Server crashes between the two. Obligation is approved but no audit log exists — LEGAL-02 violated.
**Why it happens:** Feels natural to commit one thing, then continue processing.
**How to avoid:** Always use `async with session.begin()` and add both objects before the `__aexit__`. Single commit.
**Warning signs:** Two `await session.commit()` calls for a single review action.

### Pitfall 2: Double-Review Race Condition
**What goes wrong:** User clicks "Approve" twice quickly; two requests race to update the same obligation. Both succeed; audit log has two entries.
**Why it happens:** No server-side guard on current status.
**How to avoid:** Check `if obligation.status != "pending": raise HTTPException(409)` inside the transaction. The SELECT + check + UPDATE inside `session.begin()` is effectively serialized per obligation in PostgreSQL with row-level locking.
**Warning signs:** Status endpoint accepts any target status regardless of current state.

### Pitfall 3: Qdrant Collection Recreated on Restart
**What goes wrong:** Worker calls `create_collection()` on every startup without checking existence first. Every restart wipes the indexed corpus.
**Why it happens:** Startup code not idempotent.
**How to avoid:** `if not await client.collection_exists(COLLECTION_NAME): await client.create_collection(...)`.
**Warning signs:** Corpus indexing takes the same time on every restart.

### Pitfall 4: FastEmbed Model Download at Runtime
**What goes wrong:** First request to the RAG worker hangs for 30+ seconds while FastEmbed downloads the BAAI/bge-small-en-v1.5 model from HuggingFace Hub.
**Why it happens:** FastEmbed downloads model on first use.
**How to avoid:** Call `client.add(...)` (or any embedding call) during lifespan startup, not on the first Kafka message. The startup corpus indexing naturally triggers the download.
**Warning signs:** First action item processed by RAG worker takes 30+ seconds.

### Pitfall 5: AsyncQdrantClient Lifecycle
**What goes wrong:** `AsyncQdrantClient` created per-request or per-message. Connection overhead dominates latency.
**Why it happens:** Pattern copied from synchronous examples that create clients ad-hoc.
**How to avoid:** Create `AsyncQdrantClient` once in FastAPI lifespan (alongside Kafka workers). Store on `app.state.qdrant_client`. Pass to `RagMapperWorker.__init__()`.
**Warning signs:** New connection established for every Kafka message.

### Pitfall 6: Next.js CORS Mismatch
**What goes wrong:** Browser blocks fetch requests to `http://localhost:8000` from `http://localhost:3000`.
**Why it happens:** FastAPI CORS is already configured with `settings.cors_origins = ["http://localhost:3000"]`. But if `.env` overrides this or the wrong port is used, it breaks.
**How to avoid:** Confirm `.env` has `CORS_ORIGINS=["http://localhost:3000"]` or that the default is used. Use `fetch()` with `credentials: 'include'` from the frontend.
**Warning signs:** `Access-Control-Allow-Origin` missing in browser network tab.

---

## Code Examples

Verified patterns from official sources:

### Qdrant AsyncQdrantClient — Async add() Method Signature
```python
# Source: python-client.qdrant.tech/qdrant_client.async_qdrant_fastembed
async def add(
    collection_name: str,
    documents: Iterable[str],
    metadata: Optional[Iterable[dict[str, Any]]] = None,
    ids: Optional[Iterable[Union[int, str, UUID]]] = None,
    batch_size: int = 32,
    parallel: Optional[int] = None,
    **kwargs: Any
) -> list[str | int]
```

### Qdrant AsyncQdrantClient — Async query() Method Signature
```python
# Source: python-client.qdrant.tech/qdrant_client.async_qdrant_fastembed
async def query(
    collection_name: str,
    query_text: str,
    query_filter: Optional[Filter] = None,
    limit: int = 10,
    **kwargs: Any
) -> list[QueryResponse]
# result.score = cosine similarity score (0–1), result.metadata = payload dict
```

### Qdrant Collection Creation — Idempotent Pattern
```python
# Pattern: check_exists → create; FastEmbed sets vector params automatically
if not await client.collection_exists(COLLECTION_NAME):
    vector_params = client.get_fastembed_vector_params()
    await client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=vector_params,
    )
# BAAI/bge-small-en-v1.5: 384 dimensions, cosine distance
```

### shadcn/ui Resizable Component
```tsx
// Source: ui.shadcn.com/docs/components/radix/resizable
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel defaultSize={50}>Left content</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50}>Right content</ResizablePanel>
</ResizablePanelGroup>
```

### SQLAlchemy Atomic Dual-Write
```python
# Source: SQLAlchemy 2.0 docs — Transactions and Connection Management
async with session.begin():
    # Both writes go into the same transaction
    obligation.status = action
    session.add(AuditLog(
        entity_type="obligation",
        entity_id=obligation.id,
        action=action,
        actor=actor,
        metadata_={"previous_status": "pending"},
    ))
# Commit on __aexit__; rollback on exception
```

### Claude Structured Output for Action Item Generation
```python
# Pattern: same approach as ExtractWorker._extract_chunk()
# Uses messages.parse() with Pydantic output_format
class ActionItemOutput(BaseModel):
    description: str = Field(
        description="Clear, actionable business requirement derived from this regulatory obligation. "
                    "State what engineering work must be done, not just what the regulation says."
    )

response = client.messages.parse(
    model=settings.claude_model,
    max_tokens=512,
    messages=[{"role": "user", "content": ACTION_ITEM_PROMPT.format(
        obligation_text=obligation.text,
        source_quote=obligation.source_quote,
    )}],
    output_format=ActionItemOutput,
)
description = response.parsed_output.description
```

### Next.js Fetch API Call Pattern (TypeScript)
```typescript
// Typed fetch wrapper — client component "use client"
async function reviewObligation(
  obligationId: string,
  action: "approved" | "rejected"
): Promise<void> {
  const res = await fetch(
    `http://localhost:8000/api/obligations/${obligationId}/review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      credentials: "include",
    }
  )
  if (!res.ok) throw new Error(`Review failed: ${res.status}`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sentence-transformers + separate Qdrant client | `qdrant-client[fastembed]` with `client.add()` / `client.query()` | qdrant-client 1.4+ | No separate embedding step; fastembed handles encoding via ONNX on CPU |
| Separate Kafka producer per endpoint | `BaseProducer` subclassed per worker, lifecycle-independent from FastAPI | Established in Phase 1 | Workers must own their own producers (02-01 decision) |
| `@app.on_event("startup")` | `@asynccontextmanager lifespan(app)` | FastAPI 0.93+ | `@app.on_event` is deprecated — use lifespan (01-01 decision) |
| `QdrantClient` (sync) in async FastAPI | `AsyncQdrantClient` | qdrant-client 1.6.1+ | Sync client blocks event loop |

**Deprecated/outdated:**
- `QdrantClient` (sync) in async FastAPI context: blocks event loop, use `AsyncQdrantClient`
- shadcn component add via `npx shadcn-ui@latest` (old package name): use `npx shadcn@latest` (new package name as of 2024)
- bitnami/kafka Docker image: already switched to apache/kafka:3.9.2 (01-02 decision)

---

## Key Design Decisions for Claude's Discretion

### Embedding Model: BAAI/bge-small-en-v1.5
**Recommendation:** Use BAAI/bge-small-en-v1.5 (FastEmbed default).
- 384 dimensions, cosine distance
- Runs locally via ONNX (no API key, no network call at inference time)
- Default model in `qdrant-client[fastembed]` — requires zero configuration
- Confirmed HIGH confidence: FastEmbed documentation states this is the default model

### Corpus Chunk Size: ~800 characters
**Recommendation:** Chunk corpus docs at ~800 characters with 100-character overlap.
- Service docs are ~500-1000 words → 3-6 chunks per doc
- 6 docs × ~4 chunks = ~24 total vectors — trivially small corpus
- Smaller chunks (800 chars vs 16K used for PDF extraction) improve retrieval precision since each vector represents a specific capability, not a whole document
- At >80% precision target with 24 vectors and domain-specific queries, this is sufficient

### Frontend Framework: Next.js 15 with App Router
**Recommendation:** Next.js 15 with App Router.
- `cors_origins` already configured for `http://localhost:3000`
- Standard for FastAPI + React frontends in 2025-2026
- App Router enables server components for initial data fetch, client components for interactive cards

### Component Library: shadcn/ui
**Recommendation:** shadcn/ui with Tailwind CSS.
- Ships `Resizable` component (required for split panel — do not hand-roll)
- `Card`, `Badge`, `Button`, `ScrollArea` — all needed for obligation cards
- Wealthsimple aesthetic achieved via slate/teal palette in `tailwind.config`
- No runtime dependency — components copied into project, fully customizable

### Qdrant Collection Config
**Recommendation:**
- `collection_name = "wealthsimple_services"`
- Vector params via `client.get_fastembed_vector_params()` (auto-sets 384-dim cosine)
- No quantization needed (24 vectors — negligible memory)

---

## Open Questions

1. **Docker service for frontend**
   - What we know: `docker-compose.yml` has backend, kafka, postgres, qdrant. No frontend service.
   - What's unclear: Does the planner add a `frontend` Docker service or run it separately with `npm run dev`?
   - Recommendation: Add a `frontend` service to `docker-compose.yml` (Node image, port 3000) for consistency. Development can still use `npm run dev` outside Docker.

2. **Qdrant client in lifespan vs. worker**
   - What we know: Workers own their lifecycle (02-01 decision). But `AsyncQdrantClient` is needed both for corpus indexing at startup AND inside `RagMapperWorker`.
   - What's unclear: Should `AsyncQdrantClient` live on `app.state` and be passed to the worker, or should the worker create its own?
   - Recommendation: Create `AsyncQdrantClient` in lifespan (for corpus indexing), store on `app.state.qdrant_client`, and pass it to `RagMapperWorker.__init__()` — avoids duplicating connection management.

3. **Action item prompt quality**
   - What we know: Claude must produce a "substantive transformation" not just a copy of obligation text.
   - What's unclear: Specific prompt structure needs iteration.
   - Recommendation: Prompt should include the obligation text, source quote, and explicitly instruct Claude to produce an engineering-facing requirement: "Who must do what, by when, and what system must be modified." This is Claude's discretion per CONTEXT.md.

---

## Sources

### Primary (HIGH confidence)
- [python-client.qdrant.tech/qdrant_client.async_qdrant_fastembed](https://python-client.qdrant.tech/qdrant_client.async_qdrant_fastembed) — `add()` and `query()` method signatures
- [python-client.qdrant.tech/qdrant_client.async_qdrant_client](https://python-client.qdrant.tech/qdrant_client.async_qdrant_client) — `create_collection()` and `collection_exists()` signatures; async support since v1.6.1
- [pypi.org/project/qdrant-client/](https://pypi.org/project/qdrant-client/) — version 1.17.0 (Feb 2026), Python >=3.10, `[fastembed]` extra
- [qdrant.github.io/fastembed](https://qdrant.github.io/fastembed/Getting%20Started/) — BAAI/bge-small-en-v1.5 is default model, 384 dimensions
- [ui.shadcn.com/docs/components/radix/resizable](https://ui.shadcn.com/docs/components/radix/resizable) — Resizable component API, `orientation="horizontal"`, `withHandle` prop
- [ui.shadcn.com/docs/installation/next](https://ui.shadcn.com/docs/installation/next) — `npx shadcn@latest init` command, Next.js 15 + React 19 support confirmed
- Existing codebase: `BaseConsumer`, `BaseProducer`, `KafkaTopic`, `AuditLog`, `Obligation`, `ActionItem`, `SystemMapping` models — HIGH confidence (read directly)

### Secondary (MEDIUM confidence)
- [github.com/qdrant/qdrant-client/issues/1022](https://github.com/qdrant/qdrant-client/issues/1022) — `collection_exists()` pattern verified; `if_not_exists` param not yet implemented
- [strapi.io/blog/react-markdown-complete-guide](https://strapi.io/blog/react-markdown-complete-guide-security-styling) — react-markdown v9 patterns, `@tailwindcss/typography` integration
- [docs.sqlalchemy.org/en/20/orm/session_transaction.html](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html) — `async with session.begin()` atomic commit pattern

### Tertiary (LOW confidence)
- Wealthsimple aesthetic details (teal/navy palette, generous whitespace) — inferred from reference URL in CONTEXT.md; specific hex values to be determined during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via PyPI, official qdrant-client docs, shadcn/ui docs
- Architecture: HIGH — patterns derived directly from existing codebase conventions + official docs
- Pitfalls: HIGH — derived from actual codebase decisions (STATE.md) and qdrant-client issue tracker
- RAG embedding: HIGH — BAAI/bge-small-en-v1.5 is the documented default in FastEmbed
- Frontend: MEDIUM-HIGH — Next.js 15 + shadcn/ui confirmed current standard; specific Wealthsimple color tokens LOW (aesthetic judgment)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable libraries; qdrant-client, shadcn/ui release frequently but APIs are stable)
