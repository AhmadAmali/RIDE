# Phase 2: Ingestion and Extraction - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Upload a regulatory PDF, parse it to structure-preserving Markdown, then extract structured obligations with verbatim source quotes, chain-of-thought reasoning, and ambiguity flags. Output: obligations visible in the database and ready for legal review (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### PDF Parsing
- Native text PDFs only for v1 — scanned/OCR support deferred to future phase
- Preserve document structure in Markdown: headings, tables, bulleted/numbered lists
- Store full Markdown as single blob in `Document.content_markdown` — chunking happens at extraction time, not at storage
- Claude has discretion on parsing library choice (PyMuPDF and pdfplumber are both viable)

### Upload Experience
- Single file upload endpoint (`POST /api/documents/upload`)
- Reasonable file size limit (~50MB)
- Async processing — upload returns immediately with document ID and status "uploaded"
- Document status progresses: uploaded -> parsed -> extracted
- No batch upload for v1

### Extraction Prompt Design
- Chunk long documents into overlapping windows when feeding to Claude for extraction
- Claude structured output schema per obligation: text (summary), source_quote (verbatim), reasoning (2-3 sentences explaining WHY this is an obligation), is_ambiguous flag
- "Ambiguous" = regulatory language that could be interpreted multiple ways or has unclear scope requiring human judgment
- Chain-of-thought reasoning should be substantive — not just "this is an obligation" but WHY the text creates a compliance requirement

### Error Handling
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Document` model (`backend/ride/models/document.py`): Has filename, original_url, content_markdown, status fields — ready for upload and parsing
- `Obligation` model (`backend/ride/models/obligation.py`): Has text, source_quote, reasoning, is_ambiguous, status — matches extraction output exactly
- `BaseConsumer` (`backend/ride/kafka/consumer.py`): ABC with DLQ routing, at-least-once delivery — subclass for parse and extract workers
- `BaseProducer` (`backend/ride/kafka/producer.py`): JSON serialization via send_and_wait — use to emit events between pipeline stages
- `KafkaTopic` StrEnum: DOCUMENT_UPLOADED, DOCUMENT_PARSED, OBLIGATION_EXTRACTED topics already defined

### Established Patterns
- Async SQLAlchemy with asyncpg — all DB access through `async_session_maker` and `get_db`
- Pydantic Settings for config — add new env vars (e.g., Claude API key) to `Settings` class
- Kafka event-driven pipeline — workers consume topic, process, produce to next topic

### Integration Points
- `backend/ride/api/routes/` — empty, upload endpoint goes here
- `backend/ride/workers/` — empty `__init__.py`, parse and extract workers go here
- `backend/ride/api/main.py` — FastAPI app needs router registration for upload route
- `docker-compose.yml` — may need worker service entries or run workers in backend container

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The pipeline flow is clear from the Kafka topics: upload -> DOCUMENT_UPLOADED -> parse worker -> DOCUMENT_PARSED -> extract worker -> OBLIGATION_EXTRACTED.

</specifics>

<deferred>
## Deferred Ideas

- Scanned/image PDF support with OCR — future phase
- Batch upload of multiple documents — future enhancement
- URL-based document ingestion (INGEST-03) — v2 requirement
- Automatic retries on failure — future enhancement

</deferred>

---

*Phase: 02-ingestion-and-extraction*
*Context gathered: 2026-03-02*
