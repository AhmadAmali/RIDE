---
phase: 02-ingestion-and-extraction
verified: 2026-03-02T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 2: Ingestion and Extraction Verification Report

**Phase Goal:** A regulatory PDF uploaded by the user produces structured obligations with verbatim source quotes, chain-of-thought reasoning, and ambiguity flags — visible in the database and ready for legal review
**Verified:** 2026-03-02
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                             | Status     | Evidence                                                                                                                 |
|----|-------------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------------------|
| 1  | User can upload a PDF via POST /api/documents/upload and receive a document_id with status "uploaded"             | VERIFIED   | `documents.py` line 18 defines `@router.post("/upload")`, returns `{"document_id", "status": "uploaded", "filename"}`  |
| 2  | Uploaded PDF is saved to /uploads volume and a Document record exists in PostgreSQL with status "uploaded"        | VERIFIED   | `documents.py` lines 33-67: `os.makedirs(upload_dir)`, `aiofiles.open(upload_path, "wb")`, `Document(status="uploaded")`, `db.commit()` |
| 3  | Parse worker consumes DOCUMENT_UPLOADED, converts PDF to Markdown, stores content_markdown, emits DOCUMENT_PARSED | VERIFIED   | `parse_worker.py` lines 18, 36, 44-46, 49-52: `BaseConsumer(DOCUMENT_UPLOADED)`, `asyncio.to_thread(pymupdf4llm.to_markdown)`, `doc.content_markdown = md_text`, `doc.status = "parsed"`, `send(DOCUMENT_PARSED)` |
| 4  | Parsed Markdown preserves headings, tables, and lists from the original PDF                                       | VERIFIED   | `parse_worker.py` line 36 uses `pymupdf4llm.to_markdown` which is a structure-preserving converter; non-blocking via `asyncio.to_thread` |
| 5  | Non-PDF files are rejected with 422; files exceeding 50MB are rejected with 413                                   | VERIFIED   | `documents.py` lines 27-29: magic-byte check raises `HTTPException(422)`; lines 46-54: size guard raises `HTTPException(413)` with partial-file cleanup |
| 6  | Each extracted obligation has a verbatim source_quote copied from the original document                           | VERIFIED   | `obligation.py` line 8-10: `ObligationItem.source_quote` field with description "Verbatim text from the document"; `EXTRACTION_PROMPT` instructs Claude to "Copy the EXACT verbatim text"; `Obligation` ORM `source_quote` column nullable=False |
| 7  | Each extracted obligation has a chain-of-thought reasoning field explaining WHY the text creates a compliance requirement | VERIFIED | `obligation.py` line 11-13: `ObligationItem.reasoning` field; `EXTRACTION_PROMPT` instructs "Explain in 2-3 sentences WHY this text creates a compliance requirement ... Be substantive"; persisted to `Obligation.reasoning` |
| 8  | Obligations flagged as ambiguous have is_ambiguous=True in the database                                           | VERIFIED   | `obligation.py` line 14-16: `ObligationItem.is_ambiguous: bool`; `extract_worker.py` line 93: `is_ambiguous=item.is_ambiguous` persisted to `Obligation.is_ambiguous` (NOT NULL, default False) |
| 9  | Long documents are chunked into overlapping windows before sending to Claude — obligations are not lost at chunk boundaries | VERIFIED | `obligation.py` lines 46-60: `chunk_markdown(chunk_chars=16000, overlap_chars=1600)` — 10% overlap; `extract_worker.py` line 58: `chunks = chunk_markdown(content_markdown)`, deduplication loop lines 69-79 prevents cross-chunk duplicates |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact                                        | Expected                                                              | Status    | Details                                                                                    |
|-------------------------------------------------|-----------------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------|
| `backend/ride/api/routes/documents.py`          | POST /api/documents/upload endpoint                                   | VERIFIED  | 77 lines, full implementation: magic-byte validation, streaming size guard, DB record, Kafka event |
| `backend/ride/workers/parse_worker.py`          | ParseWorker consuming DOCUMENT_UPLOADED, producing DOCUMENT_PARSED    | VERIFIED  | 53 lines, complete BaseConsumer subclass with lifecycle, pymupdf4llm, DB update, Kafka emit |
| `backend/ride/config.py`                        | Settings with upload_dir, max_upload_bytes, anthropic_api_key, claude_model | VERIFIED | All four fields present: lines 21-22, 25-26                                          |
| `backend/ride/schemas/obligation.py`            | Pydantic ObligationItem and ObligationList models for Claude structured output | VERIFIED | 61 lines: both models, EXTRACTION_PROMPT constant, chunk_markdown() helper          |
| `backend/ride/workers/extract_worker.py`        | ExtractWorker consuming DOCUMENT_PARSED, calling Claude, persisting obligations | VERIFIED | 131 lines, complete implementation: Claude call, deduplication, DB persistence, status update, Kafka emit |
| `backend/ride/schemas/__init__.py`              | Package init for schemas module                                       | VERIFIED  | File exists (empty, as expected for package init)                                          |
| `backend/ride/api/main.py`                      | Lifespan with both workers wired as asyncio tasks                     | VERIFIED  | 71 lines: parse_worker (line 26) and extract_worker (line 33) started as create_task; proper shutdown sequence |
| `backend/requirements.txt`                      | pymupdf4llm, anthropic, python-multipart, aiofiles dependencies       | VERIFIED  | All four present on lines 12-15                                                            |
| `docker-compose.yml`                            | uploads_data named volume mounted at /uploads on backend service      | VERIFIED  | Line 65: `uploads_data:/uploads`; line 79: `uploads_data:` in top-level volumes           |
| `.env.example`                                  | ANTHROPIC_API_KEY, UPLOAD_DIR, MAX_UPLOAD_BYTES documented            | VERIFIED  | All three present on lines 16-19                                                           |

---

### Key Link Verification

| From                                          | To                                              | Via                                                      | Status    | Details                                                                                    |
|-----------------------------------------------|-------------------------------------------------|----------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------|
| `backend/ride/api/routes/documents.py`        | `backend/ride/kafka/producer.py`                | `app.state.kafka_producer.send(KafkaTopic.DOCUMENT_UPLOADED)` | VERIFIED | Lines 71-74: `await request.app.state.kafka_producer.send(KafkaTopic.DOCUMENT_UPLOADED, {...})` |
| `backend/ride/workers/parse_worker.py`        | `backend/ride/kafka/topics.py`                  | BaseConsumer on DOCUMENT_UPLOADED, emitting DOCUMENT_PARSED | VERIFIED | Line 18: `super().__init__(KafkaTopic.DOCUMENT_UPLOADED)`; lines 49-52: `send(KafkaTopic.DOCUMENT_PARSED)` |
| `backend/ride/api/main.py`                    | `backend/ride/api/routes/documents.py`          | `app.include_router(documents_router)`                   | VERIFIED  | Line 7 import; line 65: `app.include_router(documents_router)`                             |
| `backend/ride/api/main.py`                    | `backend/ride/workers/parse_worker.py`          | `asyncio.create_task(parse_worker.run())` in lifespan    | VERIFIED  | Line 11 import; lines 24-26: `ParseWorker()`, `await parse_worker.start()`, `create_task(parse_worker.run())` |
| `backend/ride/workers/extract_worker.py`      | `backend/ride/schemas/obligation.py`            | `client.messages.parse(output_format=ObligationList)`    | VERIFIED  | Lines 15-20: imports `ObligationItem, ObligationList, EXTRACTION_PROMPT, chunk_markdown`; line 128: `output_format=ObligationList` |
| `backend/ride/workers/extract_worker.py`      | `backend/ride/models/obligation.py`             | `Obligation(...)` ORM model for DB persistence           | VERIFIED  | Line 14 import; lines 88-96: `Obligation(document_id=..., text=..., source_quote=..., reasoning=..., is_ambiguous=..., status="pending")` |
| `backend/ride/workers/extract_worker.py`      | `backend/ride/kafka/topics.py`                  | BaseConsumer on DOCUMENT_PARSED, emitting OBLIGATION_EXTRACTED | VERIFIED | Line 29: `super().__init__(KafkaTopic.DOCUMENT_PARSED)`; lines 107-109: `send(KafkaTopic.OBLIGATION_EXTRACTED, {...})` |
| `backend/ride/api/main.py`                    | `backend/ride/workers/extract_worker.py`        | `asyncio.create_task(extract_worker.run())` in lifespan  | VERIFIED  | Line 11 import; lines 31-33: `ExtractWorker()`, `await extract_worker.start()`, `create_task(extract_worker.run())` |

All 8 key links: WIRED

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                   | Status    | Evidence                                                                                                     |
|-------------|-------------|-----------------------------------------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------------------|
| INGEST-01   | 02-01       | User can upload a regulatory PDF document                                                     | SATISFIED | `POST /api/documents/upload` endpoint fully implemented with validation, DB record, Kafka event              |
| INGEST-02   | 02-01       | System extracts structure-preserving Markdown from PDF (tables, sections, headings intact)    | SATISFIED | `ParseWorker` calls `pymupdf4llm.to_markdown` (structure-preserving), stores in `Document.content_markdown`  |
| EXTRACT-01  | 02-02       | System extracts structured obligations from regulatory document with verbatim source quotes   | SATISFIED | `ExtractWorker` + `ObligationItem.source_quote` (NOT NULL in DB); EXTRACTION_PROMPT demands exact verbatim copy |
| EXTRACT-02  | 02-02       | System displays transparent chain-of-thought reasoning per extracted obligation               | SATISFIED | `ObligationItem.reasoning` field; EXTRACTION_PROMPT instructs substantive 2-3 sentence "WHY" explanation; stored in `Obligation.reasoning` |
| EXTRACT-03  | 02-02       | System flags ambiguous regulatory language that requires human judgment                       | SATISFIED | `ObligationItem.is_ambiguous: bool`; EXTRACTION_PROMPT defines ambiguity criteria; stored in `Obligation.is_ambiguous` (Boolean, NOT NULL) |

No orphaned requirements — all five Phase 2 requirement IDs are claimed by plans and have verified implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | —    | —       | —        | No anti-patterns detected in any phase 02 file |

Anti-pattern scan covered all created/modified files:
- `backend/ride/api/routes/documents.py` — no TODOs, no placeholder returns, no stub handlers
- `backend/ride/workers/parse_worker.py` — no TODOs, no empty implementations
- `backend/ride/workers/extract_worker.py` — no TODOs, no placeholder returns
- `backend/ride/schemas/obligation.py` — no TODOs, substantive models and prompt
- `backend/ride/api/main.py` — no leftover "Extract worker will be added" comment (removed as planned)
- `backend/ride/config.py` — no TODOs

---

### Human Verification Required

The following behaviors cannot be verified by static code inspection and require runtime testing with a real PDF and Anthropic API key:

#### 1. Claude Structured Output — Verbatim Quote Accuracy

**Test:** Upload a real regulatory PDF (e.g., a FINTRAC or SEC document), wait for extraction, then query the `obligations` table. For each row, verify that `source_quote` appears verbatim in `Document.content_markdown`.
**Expected:** Every `source_quote` value is a word-for-word substring of the original parsed Markdown.
**Why human:** Static analysis confirms the EXTRACTION_PROMPT instructs verbatim copying, but whether Claude honors this in practice requires actual API invocation.

#### 2. Claude Structured Output — Reasoning Substantiveness

**Test:** After extraction, read `reasoning` values in the `obligations` table. Verify they explain WHY the text is a compliance requirement (regulatory principle, consequence of non-compliance), not boilerplate like "this is an obligation."
**Expected:** Each `reasoning` field contains 2-3 substantive sentences specific to the obligation.
**Why human:** Prompt quality and LLM output quality cannot be verified statically.

#### 3. Ambiguity Flag Correctness

**Test:** In the extracted obligations, find at least one obligation with `is_ambiguous=True`. Verify the flagged text genuinely has unclear scope or multi-interpretation risk.
**Expected:** Obligations with vague language ("may," "reasonable," "as appropriate") are flagged; clear prescriptive obligations are not.
**Why human:** Judgment of ambiguity correctness is qualitative and requires reading the source document alongside the AI output.

#### 4. End-to-End Pipeline Health Check

**Test:** `docker compose up -d --build`. Then: `curl -X POST http://localhost:8000/api/documents/upload -F "file=@test-regulation.pdf"`. Wait 30-60 seconds. Query PostgreSQL: `SELECT status, content_markdown IS NOT NULL, (SELECT COUNT(*) FROM obligations WHERE document_id = d.id) FROM documents d ORDER BY uploaded_at DESC LIMIT 1;`
**Expected:** status="extracted", content_markdown is not null, obligation count > 0.
**Why human:** Requires Docker environment, real PDF file, and a valid ANTHROPIC_API_KEY in `.env`.

#### 5. Non-PDF Rejection (422) and Oversized File Rejection (413)

**Test:** `curl -X POST http://localhost:8000/api/documents/upload -F "file=@test.txt"` should return 422. Upload a file >50MB should return 413.
**Expected:** Correct HTTP status codes and error messages.
**Why human:** Requires running Docker services; while the code is verified correct, runtime behavior should be confirmed once.

---

### Gaps Summary

No gaps. All must-haves verified.

The full ingestion and extraction pipeline is structurally complete and correctly wired:

- **Upload stage (INGEST-01):** POST /api/documents/upload validated (magic bytes, size), persists Document, emits DOCUMENT_UPLOADED, returns document_id.
- **Parse stage (INGEST-02):** ParseWorker subclasses BaseConsumer on DOCUMENT_UPLOADED, runs `pymupdf4llm.to_markdown` non-blocking via `asyncio.to_thread`, stores structure-preserving Markdown in `Document.content_markdown`, updates status to "parsed", emits DOCUMENT_PARSED.
- **Extract stage (EXTRACT-01, 02, 03):** ExtractWorker subclasses BaseConsumer on DOCUMENT_PARSED, chunks Markdown (16K chars / 1.6K overlap), calls Claude via `messages.parse(output_format=ObligationList)` in a thread, deduplicates across chunk boundaries via source_quote containment, persists Obligation records (text, source_quote, reasoning, is_ambiguous, status="pending"), updates Document.status to "extracted", emits OBLIGATION_EXTRACTED.
- **Lifespan wiring:** Both workers started as asyncio tasks in FastAPI lifespan with proper shutdown (cancel task, stop worker, dispose engine).
- **All 4 task commits verified in git:** d251100, bd89c4e, 8fc4c08, f0d67c5.
- **No anti-patterns, no stubs, no placeholder implementations.**

Phase 3 can immediately query `SELECT * FROM obligations WHERE document_id = ? AND status = 'pending'` to surface obligations for legal review, and filter by `is_ambiguous=True` for prioritization.

---

_Verified: 2026-03-02_
_Verifier: Claude (gsd-verifier)_
