# Phase 02: Ingestion and Extraction - Research

**Researched:** 2026-03-02
**Domain:** PDF parsing, FastAPI file upload, Claude structured output extraction, Kafka event-driven pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Native text PDFs only for v1 — scanned/OCR support deferred to future phase
- Preserve document structure in Markdown: headings, tables, bulleted/numbered lists
- Store full Markdown as single blob in `Document.content_markdown` — chunking happens at extraction time, not at storage
- PDF parsing library: Claude has discretion (PyMuPDF and pdfplumber are both viable)
- Single file upload endpoint (`POST /api/documents/upload`)
- Reasonable file size limit (~50MB)
- Async processing — upload returns immediately with document ID and status "uploaded"
- Document status progresses: uploaded -> parsed -> extracted
- No batch upload for v1
- Chunk long documents into overlapping windows when feeding to Claude for extraction
- Claude structured output schema per obligation: `text` (summary), `source_quote` (verbatim), `reasoning` (2-3 sentences explaining WHY), `is_ambiguous` flag
- "Ambiguous" = regulatory language that could be interpreted multiple ways or has unclear scope requiring human judgment
- Chain-of-thought reasoning should be substantive — not just "this is an obligation" but WHY the text creates a compliance requirement
- DLQ catches worker failures (BaseConsumer DLQ routing already built)
- User sees document stuck in current status if processing fails — no silent swallowing
- No automatic retries for v1 — user can re-upload if parsing fails
- Partial extraction is acceptable — extract what you can from successful chunks, flag the document

### Claude's Discretion
- PDF parsing library selection (PyMuPDF vs pdfplumber vs other)
- Exact chunking strategy (window size, overlap amount)
- Claude prompt engineering for extraction quality
- File validation approach (magic bytes, extension check, etc.)
- Upload endpoint response schema details

### Deferred Ideas (OUT OF SCOPE)
- Scanned/image PDF support with OCR — future phase
- Batch upload of multiple documents — future enhancement
- URL-based document ingestion (INGEST-03) — v2 requirement
- Automatic retries on failure — future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INGEST-01 | User can upload a regulatory PDF document | FastAPI `UploadFile` + `POST /api/documents/upload` with `python-multipart`; DB record created, Kafka event emitted |
| INGEST-02 | System extracts structure-preserving Markdown from PDF (tables, sections, headings intact) | `pymupdf4llm.to_markdown()` preserves headings (detected via font size), tables (tabulate-rendered), lists — stored in `Document.content_markdown` |
| EXTRACT-01 | System extracts structured obligations from regulatory document with verbatim source quotes | Claude `client.messages.parse()` with Pydantic schema containing `source_quote` field; structured output guarantees schema compliance |
| EXTRACT-02 | System displays transparent chain-of-thought reasoning per extracted obligation | `reasoning` field in obligation schema; prompt engineering instructs Claude to explain WHY text creates a compliance requirement |
| EXTRACT-03 | System flags ambiguous regulatory language that requires human judgment | `is_ambiguous: bool` field in Pydantic schema; prompt defines "ambiguous" as language with unclear scope or multiple interpretations |
</phase_requirements>

---

## Summary

Phase 2 builds a two-worker event-driven pipeline: an upload endpoint accepts a PDF and fires a Kafka event, a parse worker converts the PDF to structured Markdown and fires a second event, and an extraction worker sends the Markdown to Claude and persists structured obligations to PostgreSQL.

The standard stack is well-defined: `pymupdf4llm` for PDF-to-Markdown conversion (chosen over pdfplumber because it was specifically designed for LLM pipelines, handles headings and tables natively, and is already flagged as AGPL-acceptable in STATE.md), `python-multipart` for multipart file upload in FastAPI, the Anthropic Python SDK `client.messages.parse()` for guaranteed-schema Claude output, and `aiofiles` for non-blocking disk writes. All Kafka plumbing (BaseConsumer, BaseProducer, KafkaTopic enum, DLQ routing) is already built in Phase 1 and subclassed — not reimplemented.

The critical insight from STATE.md is that structured output + Citations API cannot be combined (400 error), so source quotes must be schema fields (`source_quote` in Pydantic model), not Citations API annotations. This was already committed as a project decision. A second critical insight: the structured output API moved out of beta — the parameter is now `output_config.format` via `client.messages.create()`, or use `client.messages.parse()` with `output_format=PydanticModel` (SDK handles the translation). No beta header is required.

**Primary recommendation:** Use `pymupdf4llm` for parsing and `client.messages.parse()` with a Pydantic `ObligationList` wrapper for extraction. Store PDFs in a mounted volume path (`/uploads`) shared between the backend container and the parse worker process.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pymupdf4llm | 0.3.4 | PDF to structure-preserving Markdown | Built for LLM pipelines; auto-detects headings via font size, renders tables with tabulate, handles lists — STATE.md already confirmed AGPL acceptable |
| anthropic | 0.84.0 | Claude API client for extraction | Official SDK; `messages.parse()` + Pydantic gives guaranteed schema-compliant JSON; no retry logic needed |
| python-multipart | >=0.0.22 | Multipart form parsing for FastAPI file upload | Required by FastAPI for `UploadFile`; install via `fastapi[standard]` or explicitly |
| aiofiles | >=23.0 | Async file I/O for saving uploaded PDFs | Prevents blocking the event loop during file writes in async FastAPI endpoints |
| pydantic | >=2.0 (already via FastAPI) | Obligation schema definition | Used with `client.messages.parse()` to define obligation structure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-magic | >=0.4.27 | MIME type validation via magic bytes | Validate PDF content-type from actual file bytes, not client-supplied header (spoofable) |
| aiofiles | >=23.0 | Non-blocking async file writes | File save in upload endpoint — prevents blocking uvicorn's event loop |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pymupdf4llm | pdfplumber | pdfplumber gives fine-grained table control but requires manual Markdown assembly; pymupdf4llm outputs Markdown directly and is purpose-built for this use case |
| pymupdf4llm | unstructured | unstructured is heavier, slower, and designed for multi-modal/OCR; overkill for native-text PDFs |
| client.messages.parse() | instructor library | instructor adds an extra dependency; SDK's native `.parse()` is sufficient and avoids the wrapper |

**Installation:**
```bash
pip install pymupdf4llm anthropic python-multipart aiofiles python-magic
```

---

## Architecture Patterns

### Recommended Project Structure
```
backend/ride/
├── api/
│   ├── main.py               # Register upload router in lifespan; mount Kafka producer
│   └── routes/
│       └── documents.py      # POST /api/documents/upload endpoint
├── workers/
│   ├── __init__.py           # (exists, empty)
│   ├── parse_worker.py       # ParseWorker(BaseConsumer) — consumes DOCUMENT_UPLOADED
│   └── extract_worker.py     # ExtractWorker(BaseConsumer) — consumes DOCUMENT_PARSED
├── schemas/
│   └── obligation.py         # Pydantic models: ObligationItem, ObligationList
└── config.py                 # Add: claude_api_key, upload_dir, max_upload_bytes
```

### Pattern 1: Upload Endpoint with Immediate Kafka Event Emission

**What:** POST /api/documents/upload accepts a PDF, validates it, saves to disk, creates a DB record with status="uploaded", emits DOCUMENT_UPLOADED Kafka event, returns document ID.

**When to use:** INGEST-01. The caller gets an immediate response with the document ID and can poll status.

**Example:**
```python
# Source: FastAPI official docs + project's BaseProducer pattern
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ride.db.session import get_db
from ride.models.document import Document
from ride.kafka.producer import BaseProducer
from ride.kafka.topics import KafkaTopic
import aiofiles, uuid, os

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    # 1. Validate file type via magic bytes
    header = await file.read(2048)
    await file.seek(0)
    if not header.startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="File must be a PDF")

    # 2. Check file size (stream to disk, check as we go)
    MAX_BYTES = 50 * 1024 * 1024  # 50MB
    doc_id = uuid.uuid4()
    upload_path = f"/uploads/{doc_id}.pdf"

    os.makedirs("/uploads", exist_ok=True)
    total_written = 0
    async with aiofiles.open(upload_path, "wb") as f:
        while chunk := await file.read(1024 * 64):
            total_written += len(chunk)
            if total_written > MAX_BYTES:
                os.remove(upload_path)
                raise HTTPException(status_code=413, detail="File exceeds 50MB limit")
            await f.write(chunk)

    # 3. Create DB record
    doc = Document(id=doc_id, filename=file.filename, status="uploaded")
    db.add(doc)
    await db.commit()

    # 4. Emit Kafka event (producer attached to app.state)
    # producer = request.app.state.kafka_producer  (see main.py pattern)
    await producer.send(KafkaTopic.DOCUMENT_UPLOADED, {"document_id": str(doc_id), "file_path": upload_path})

    return {"document_id": str(doc_id), "status": "uploaded"}
```

### Pattern 2: Parse Worker — BaseConsumer Subclass

**What:** Consumes DOCUMENT_UPLOADED, calls pymupdf4llm, stores Markdown, emits DOCUMENT_PARSED.

**When to use:** INGEST-02. Worker runs as a separate asyncio task (or separate process/container).

**Example:**
```python
# Source: project's BaseConsumer ABC pattern + pymupdf4llm docs
import pymupdf4llm
from ride.kafka.consumer import BaseConsumer
from ride.kafka.topics import KafkaTopic
from ride.db.session import async_session_maker
from ride.models.document import Document
from sqlalchemy import select

class ParseWorker(BaseConsumer):
    def __init__(self):
        super().__init__(KafkaTopic.DOCUMENT_UPLOADED, group_id="parse-worker")

    async def process(self, message: dict) -> None:
        doc_id = message["document_id"]
        file_path = message["file_path"]

        # Convert PDF to Markdown — pymupdf4llm handles headings + tables
        md_text = pymupdf4llm.to_markdown(file_path)

        async with async_session_maker() as session:
            result = await session.execute(select(Document).where(Document.id == doc_id))
            doc = result.scalar_one()
            doc.content_markdown = md_text
            doc.status = "parsed"
            await session.commit()

        # Emit to next pipeline stage
        await self._emit_parsed(doc_id)

    async def _emit_parsed(self, doc_id: str) -> None:
        from ride.kafka.producer import BaseProducer
        producer = BaseProducer()
        await producer.start()
        await producer.send(KafkaTopic.DOCUMENT_PARSED, {"document_id": doc_id})
        await producer.stop()
```

### Pattern 3: Extract Worker — Claude Structured Output

**What:** Consumes DOCUMENT_PARSED, fetches Markdown from DB, chunks it, calls Claude with Pydantic schema, persists obligations.

**When to use:** EXTRACT-01, EXTRACT-02, EXTRACT-03.

**Example:**
```python
# Source: Anthropic official docs (platform.claude.com/docs/en/build-with-claude/structured-outputs)
from pydantic import BaseModel
from anthropic import Anthropic
from typing import List

class ObligationItem(BaseModel):
    text: str                  # AI-generated summary of the obligation
    source_quote: str          # Verbatim text from the document
    reasoning: str             # 2-3 sentences explaining WHY this is an obligation
    is_ambiguous: bool         # True if language has unclear scope or multiple interpretations

class ObligationList(BaseModel):
    obligations: List[ObligationItem]

client = Anthropic()

def extract_obligations_from_chunk(chunk_text: str) -> List[ObligationItem]:
    response = client.messages.parse(
        model="claude-sonnet-4-5",  # or claude-haiku-4-5 for speed
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(chunk=chunk_text),
            }
        ],
        output_format=ObligationList,
    )
    return response.parsed_output.obligations
```

### Pattern 4: Kafka Producer in FastAPI Lifespan

**What:** Initialize and shut down the Kafka producer within FastAPI's lifespan context manager, attach to `app.state` for use in route handlers.

**When to use:** The upload endpoint needs a running producer to emit DOCUMENT_UPLOADED.

**Example:**
```python
# Source: FastAPI lifespan pattern (already used in main.py) + aiokafka docs
from contextlib import asynccontextmanager
from fastapi import FastAPI
from ride.kafka.producer import BaseProducer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize shared Kafka producer
    producer = BaseProducer()
    await producer.start()
    app.state.kafka_producer = producer
    yield
    # Shutdown
    await producer.stop()
    await engine.dispose()
```

### Pattern 5: Worker Launch as asyncio Tasks

**What:** Parse and extract workers run as long-lived asyncio tasks started from main.py lifespan or a separate worker entrypoint.

**When to use:** Single-container prototype — workers run in the same process as the API, started during lifespan. This avoids adding new Docker services while keeping the event-driven architecture intact.

**Example:**
```python
import asyncio
from ride.workers.parse_worker import ParseWorker
from ride.workers.extract_worker import ExtractWorker

@asynccontextmanager
async def lifespan(app: FastAPI):
    parse_worker = ParseWorker()
    extract_worker = ExtractWorker()
    await parse_worker.start()
    await extract_worker.start()

    parse_task = asyncio.create_task(parse_worker.run())
    extract_task = asyncio.create_task(extract_worker.run())

    yield

    parse_task.cancel()
    extract_task.cancel()
    await parse_worker.stop()
    await extract_worker.stop()
```

### Anti-Patterns to Avoid

- **Storing PDF bytes in PostgreSQL:** Keep PDFs on disk (mounted volume at `/uploads`). PostgreSQL BYTEA fields for 50MB files will bloat the DB and slow queries.
- **Calling pymupdf4llm in the upload endpoint directly:** Blocks the event loop. Always offload parsing to the Kafka worker.
- **Trusting `file.content_type` for PDF validation:** Client-supplied, trivially spoofed. Read the first 4 bytes and check for `%PDF` magic bytes.
- **Using `client.beta.messages.create()` with betas header for structured output:** Structured outputs are now GA. Use `client.messages.parse()` with `output_format=PydanticModel` — no beta header needed.
- **Sending entire document Markdown as a single Claude prompt:** Regulatory PDFs can be 100+ pages. Chunk with overlap to stay within token limits and prevent context window truncation.
- **Chunking at storage time:** Decisions locked — chunk at extraction time, store full Markdown as one blob.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF-to-Markdown with table/heading preservation | Custom pdfminer + table detector | `pymupdf4llm.to_markdown()` | Heading detection via font metrics, table rendering via tabulate, list detection — months of edge cases |
| Schema-compliant JSON from LLM | JSON parsing + retry loop | `client.messages.parse()` with Pydantic | Constrained decoding guarantees schema compliance — no retries needed |
| Multipart file handling | Raw request body parsing | `python-multipart` + FastAPI `UploadFile` | RFC-compliant parsing, streaming, size detection |
| Async file writes | Sync `open()` in async endpoint | `aiofiles` | Sync file I/O blocks uvicorn's event loop under load |
| Magic byte MIME detection | Extension-only check | `python-magic` or `b"%PDF"` byte check | Extension is trivially changed; magic bytes identify actual file format |
| DLQ error routing | Custom try/except per worker | `BaseConsumer` (already built in Phase 1) | DLQ routing, at-least-once delivery, offset commit after DLQ send — already implemented |

**Key insight:** The extraction schema (`text`, `source_quote`, `reasoning`, `is_ambiguous`) maps exactly to the `Obligation` model already in the database. No schema migration needed — Phase 1 already built the right model.

---

## Common Pitfalls

### Pitfall 1: Citations API + Structured Output = 400 Error
**What goes wrong:** Attempting to use both `output_config.format` (structured output) and the Citations API in the same request results in a 400 error from the Anthropic API.
**Why it happens:** These features use conflicting token generation constraints.
**How to avoid:** Use `source_quote` as a field in the Pydantic schema. Claude quotes verbatim when prompted correctly. This is already recorded as a locked project decision in STATE.md.
**Warning signs:** HTTP 400 from Anthropic API with a message about incompatible features.

### Pitfall 2: Structured Output API Parameter Migration
**What goes wrong:** Using the old beta header `anthropic-beta: structured-outputs-2025-11-13` with `client.beta.messages.create()` and `output_format` parameter.
**Why it happens:** API moved from beta to GA. Old parameters still work during transition, but using `client.messages.parse()` with `output_format=PydanticModel` is the current canonical form.
**How to avoid:** Use `client.messages.parse()`. Do NOT use `client.beta.messages.create()` for structured output — it is not needed.
**Warning signs:** Deprecation warnings in SDK output.

### Pitfall 3: Blocking I/O in Async FastAPI Endpoint
**What goes wrong:** Using `open(path, "wb")` inside an `async def` endpoint to save the uploaded file. Under concurrent requests, this blocks uvicorn's event loop.
**Why it happens:** Standard `open()` is synchronous; FastAPI routes run in the asyncio event loop.
**How to avoid:** Use `aiofiles.open()` for all file writes in async route handlers.
**Warning signs:** Slow response times under concurrent upload load; event loop lag metrics spike.

### Pitfall 4: Large Markdown Sent as Single Claude Prompt
**What goes wrong:** A 100-page regulatory PDF produces ~80,000 tokens of Markdown. Sending the whole thing in one prompt exhausts max_tokens budget for the response, and Claude may truncate obligations.
**Why it happens:** Claude's context window can handle large inputs, but the output token budget limits response size. Many obligations in a large document cannot be returned in one structured output call.
**How to avoid:** Chunk the Markdown into overlapping windows. Recommended baseline: 4,000-token chunks with 400-token overlap (10%). Use character count as proxy: ~16,000 chars per chunk with ~1,600 char overlap.
**Warning signs:** `ObligationList.obligations` is empty or suspiciously short for long documents; Claude's response hits `max_tokens` limit.

### Pitfall 5: Kafka Producer Not Running When Upload Endpoint Called
**What goes wrong:** Upload endpoint tries to call `app.state.kafka_producer.send()` but the producer was not started in lifespan, raising an AttributeError or "producer is not started" error.
**Why it happens:** FastAPI lifespan is the correct place to initialize long-lived async resources. If the producer is instantiated but not started, aiokafka raises an error on send.
**How to avoid:** Initialize AND call `await producer.start()` in lifespan before yield. Attach to `app.state.kafka_producer`. Always call `await producer.stop()` after yield.
**Warning signs:** `AttributeError: 'FastAPI' object has no attribute 'kafka_producer'` or aiokafka "not started" error.

### Pitfall 6: asyncpg < 0.30.0 Constraint
**What goes wrong:** Installing asyncpg >= 0.30.0 causes SQLAlchemy async dialect incompatibility.
**Why it happens:** Already identified in Phase 1 (STATE.md decision [01-01]).
**How to avoid:** Keep `asyncpg>=0.28.0,<0.30.0` in requirements.txt. Adding anthropic and pymupdf4llm to requirements.txt must not trigger an asyncpg upgrade.
**Warning signs:** SQLAlchemy raises errors on DB connection; alembic migrations fail.

---

## Code Examples

Verified patterns from official sources:

### pymupdf4llm Basic Markdown Extraction
```python
# Source: https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/api.html
import pymupdf4llm

# Returns a single Markdown string — headings, tables, lists preserved
md_text: str = pymupdf4llm.to_markdown("/path/to/document.pdf")

# With page-level chunking (returns list of dicts with metadata)
page_chunks = pymupdf4llm.to_markdown("/path/to/document.pdf", page_chunks=True)
# Each dict has: "text" (Markdown), "metadata", "toc_items", etc.
```

### Claude Structured Output with Pydantic (GA API)
```python
# Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
from pydantic import BaseModel
from anthropic import Anthropic
from typing import List

class ObligationItem(BaseModel):
    text: str
    source_quote: str
    reasoning: str
    is_ambiguous: bool

class ObligationList(BaseModel):
    obligations: List[ObligationItem]

client = Anthropic()

response = client.messages.parse(
    model="claude-sonnet-4-5",
    max_tokens=4096,
    messages=[{"role": "user", "content": prompt}],
    output_format=ObligationList,  # SDK handles translation to output_config.format
)

obligations: List[ObligationItem] = response.parsed_output.obligations
```

### FastAPI File Upload Endpoint
```python
# Source: https://fastapi.tiangolo.com/tutorial/request-files/
from fastapi import APIRouter, UploadFile, File, HTTPException
import aiofiles

router = APIRouter()

@router.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    # Magic byte validation
    header = await file.read(4)
    await file.seek(0)
    if header != b"%PDF":
        raise HTTPException(status_code=422, detail="File must be a PDF")

    # Stream to disk with size guard
    doc_id = str(uuid.uuid4())
    path = f"/uploads/{doc_id}.pdf"
    total = 0
    async with aiofiles.open(path, "wb") as f:
        while chunk := await file.read(65536):
            total += len(chunk)
            if total > 50 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File exceeds 50MB")
            await f.write(chunk)

    return {"document_id": doc_id, "status": "uploaded"}
```

### Extraction Prompt Template
```python
# Source: Anthropic prompt engineering docs + project CONTEXT.md decisions
EXTRACTION_PROMPT = """You are a compliance analyst reviewing a regulatory document.

Analyze the following excerpt and identify all compliance obligations — requirements, prohibitions, or duties that an organization must fulfill.

For each obligation you identify:
1. Write a clear summary in your own words (text field)
2. Copy the EXACT verbatim text from the document that establishes this obligation (source_quote field)
3. Explain in 2-3 sentences WHY this text creates a compliance requirement — what regulatory principle it enforces and what the consequence of non-compliance would be (reasoning field)
4. Set is_ambiguous to true if the language could be interpreted multiple ways, has unclear scope, or requires human judgment to apply (is_ambiguous field)

Only include genuine obligations. Informational statements, definitions, and recitals are not obligations.

Document excerpt:
---
{chunk}
---"""
```

### Document Chunking Helper
```python
# Source: Research findings on chunking strategies; recommended 4k token window / 10% overlap
def chunk_markdown(markdown: str, chunk_chars: int = 16000, overlap_chars: int = 1600) -> list[str]:
    """Split Markdown into overlapping character windows.

    16,000 chars ≈ 4,000 tokens. Overlap is 10% to avoid splitting obligations at boundaries.
    """
    chunks = []
    start = 0
    while start < len(markdown):
        end = start + chunk_chars
        chunks.append(markdown[start:end])
        start += chunk_chars - overlap_chars
    return chunks
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `client.beta.messages.create()` with `betas=["structured-outputs-2025-11-13"]` | `client.messages.parse()` with `output_format=PydanticModel` — no beta header | Late 2025 (GA release) | No beta header needed; `output_config.format` is canonical; old parameters still work during transition |
| `@app.on_event("startup")` FastAPI lifecycle | `@asynccontextmanager async def lifespan(app)` | FastAPI 0.93+ | Already used in project's main.py — continue this pattern |
| Bitnami Kafka image | `apache/kafka:3.9.2` | 2024-2025 (Bitnami removed from Docker Hub) | Already applied in Phase 1 — no change needed |

**Deprecated/outdated:**
- `client.beta.messages.create()` for structured output: works during transition but use `client.messages.parse()` instead
- `@app.on_event("startup")`: deprecated in FastAPI; project already uses lifespan

---

## Open Questions

1. **Worker process topology — same container vs separate Docker service**
   - What we know: docker-compose.yml has no worker service; backend container mounts `./backend:/app`; workers use async tasks
   - What's unclear: whether asyncio tasks inside the uvicorn process are sufficient vs needing a separate entrypoint (e.g., `python -m ride.workers.run_workers`)
   - Recommendation: Start workers as asyncio tasks inside the FastAPI lifespan for simplicity. If isolation is needed later, add a worker service to docker-compose.yml that runs a separate entrypoint.

2. **Upload file storage path**
   - What we know: docker-compose.yml mounts `./backend:/app` but no `/uploads` volume is defined; both API (upload) and parse worker (read) need access to the same file
   - What's unclear: whether to mount a shared volume or run both in the same process (resolves if workers are asyncio tasks in the same container)
   - Recommendation: If workers run as asyncio tasks in the backend container, `/uploads` inside the container is shared. Add a Docker volume `uploads_data:/uploads` to docker-compose.yml so files persist across restarts.

3. **Claude model selection for extraction**
   - What we know: SDK supports claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5 with structured output
   - What's unclear: whether extraction quality requires Sonnet/Opus or Haiku is sufficient; no workbench validation done yet (flagged in STATE.md blockers)
   - Recommendation: Default to `claude-sonnet-4-5` for extraction quality; make model name a settings variable so it can be swapped. STATE.md explicitly flags "Claude structured output schema and quote-first extraction prompting need Workbench validation before writing the extraction worker."

---

## Sources

### Primary (HIGH confidence)
- `https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/api.html` — pymupdf4llm API: `to_markdown()`, `page_chunks`, table_strategy, header detection
- `https://platform.claude.com/docs/en/build-with-claude/structured-outputs` — Claude structured output GA API: `output_config.format`, `client.messages.parse()`, Pydantic integration, no beta header required
- `https://pypi.org/project/pymupdf4llm/` — pymupdf4llm version 0.3.4, AGPL-3.0 license
- `https://pypi.org/project/anthropic/` — anthropic Python SDK version 0.84.0
- `https://fastapi.tiangolo.com/tutorial/request-files/` — FastAPI UploadFile, python-multipart requirement, multipart form handling
- `https://fastapi.tiangolo.com/tutorial/background-tasks/` — FastAPI background task patterns

### Secondary (MEDIUM confidence)
- WebSearch + pypi.org cross-reference: python-multipart 0.0.22, install via `fastapi[standard]`
- WebSearch + official docs: Chunking strategy baseline 4,000 tokens / 10% overlap — verified across Pinecone, Weaviate, Azure AI Search documentation
- WebSearch + Anthropic docs: `client.messages.parse()` is the SDK's Pydantic integration; translates `output_format=Model` to `output_config.format` internally

### Tertiary (LOW confidence)
- Magic byte PDF validation (`b"%PDF"` prefix) — widely documented in FastAPI security guides, not from a single authoritative source
- "Regulatory PDFs commonly have complex tables requiring pdfplumber for accuracy" — comparative study at arxiv.org, but pymupdf4llm's specific LLM-mode is not directly compared in the same study

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via pypi.org (versions), official Anthropic docs (structured output API), official pymupdf docs (API surface), official FastAPI docs (UploadFile)
- Architecture: HIGH — patterns directly follow existing BaseConsumer/BaseProducer/KafkaTopic infrastructure from Phase 1; no novel patterns introduced
- Pitfalls: HIGH for Citations API conflict (STATE.md locked decision), MEDIUM for chunking sizes (research consensus, not empirically validated for this specific corpus)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable libraries; anthropic SDK moves fast — verify structured output API shape before coding)
