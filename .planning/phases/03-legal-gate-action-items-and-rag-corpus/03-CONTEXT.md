# Phase 3: Legal Gate, Action Items, and RAG Corpus - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Legal reviewer approves/rejects obligations with full evidence displayed, approved obligations become structured action items, and the RAG system mapper has a working mock Wealthsimple corpus ready for suggestions. This phase adds the first human-in-the-loop gate and the RAG foundation.

</domain>

<decisions>
## Implementation Decisions

### Legal Review Experience — Visual-First
- Split panel layout: left side shows the original document Markdown, right side shows extracted obligations as interactive cards with approve/reject actions
- Reviewer reads the source document and acts on obligations side-by-side — no approve/reject without evidence visible
- Each obligation card shows: AI summary (text), verbatim source quote (highlighted/indented), chain-of-thought reasoning, ambiguity badge if flagged
- One-at-a-time review per obligation — no batch approve/reject for v1 (compliance accountability)
- Audit log entry created in the SAME database transaction as the status update — no state change without audit trail
- `is_ambiguous` obligations visually distinct (badge or color treatment) so reviewer pays extra attention

### Design Language — Wealthsimple-Inspired
- Clean, minimal aesthetic with generous whitespace
- Sans-serif typography with bold headline hierarchy and regular weight body text
- Card-based UI components with subtle shadows
- Muted, professional color palette — deep teal/navy primary, white backgrounds, clear contrast
- Large, prominent action buttons for approve/reject
- Modern fintech feel — trust, clarity, accessibility
- Reference: https://www.wealthsimple.com/en-ca landing page aesthetic

### Service Selection — Multi-Select
- When RAG suggests affected systems, the reviewer/engineer can multi-select relevant services (not limited to single pick)
- UI should present service suggestions as selectable chips or checkboxes — easy to confirm multiple at once
- This streamlines the workflow: reviewer sees suggestions, confirms the relevant ones in one action

### Action Item Generation
- Triggered automatically when obligation is approved — Kafka event OBLIGATION_APPROVED → worker generates action item
- Claude generates a structured business action item description from the obligation text (not just a copy — substantive transformation)
- Owner and deadline fields left NULL for now — populated by engineering reviewer in Phase 4
- One action item per approved obligation

### Mock Corpus Design
- 6 mock Wealthsimple services: KYC, Trading Engine, Tax Reporting, Compliance Reporting, Auth, Notifications
- Each service gets a realistic markdown doc (~500-1000 words): purpose, key capabilities, data handled, regulatory touchpoints
- Committed to repo under data/corpus/ — indexed into Qdrant at startup
- Chunked and embedded for semantic search

### RAG Suggestion Behavior
- Return top 3 system suggestions per action item, ranked by confidence
- Show all results above a minimum threshold (e.g., 0.5 confidence)
- If nothing above threshold, return empty suggestions — don't force low-quality matches
- Each suggestion stored as a SystemMapping record with suggested_by="rag" and confirmed=False

### Claude's Discretion
- Frontend framework choice (React, Next.js, etc.) and component library
- Embedding model selection for corpus indexing
- Exact Qdrant collection configuration (distance metric, vector dimensions)
- Chunk size for corpus documents
- Specific color hex values and spacing tokens matching Wealthsimple aesthetic
- Action item prompt engineering for quality descriptions

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Obligation` model (backend/ride/models/obligation.py): text, source_quote, reasoning, is_ambiguous, status (pending → approved/rejected) — ready for review actions
- `ActionItem` model (backend/ride/models/action_item.py): description, owner, deadline, status, FK to obligations — ready for generation
- `SystemMapping` model (backend/ride/models/system_mapping.py): system_name, confidence_score, suggested_by, confirmed, engineer_note — ready for RAG suggestions
- `AuditLog` model (backend/ride/models/audit_log.py): entity_type, entity_id, action, actor, metadata JSONB — ready for approve/reject logging
- `BaseConsumer`/`BaseProducer` — subclass for action item generation worker and RAG mapping worker
- `KafkaTopic` StrEnum: OBLIGATION_APPROVED, ACTION_ITEM_GENERATED, SYSTEM_MAPPING_PROPOSED already defined
- Qdrant container already in docker-compose.yml (ports 6333, 6334) with health check

### Established Patterns
- Async SQLAlchemy with get_db dependency injection
- Kafka event-driven pipeline: worker consumes topic → processes → produces to next topic
- FastAPI router pattern (documents.py exists as reference)
- Pydantic Settings for configuration (add embedding model, Qdrant URL, etc.)

### Integration Points
- `backend/ride/api/routes/` — add obligations.py router for review endpoints
- `backend/ride/workers/` — add action_item_worker.py and rag_mapper_worker.py
- `backend/ride/api/main.py` — register new routers, add new workers to lifespan
- Frontend — NEW: this is the first phase requiring a frontend (no frontend exists yet)
- `data/corpus/` — NEW directory for mock service documentation

</code_context>

<specifics>
## Specific Ideas

- "Very visual" — the legal review experience should feel polished, not like a raw admin panel
- Wealthsimple's landing page as design reference — clean, modern fintech aesthetic
- Multi-select for services to streamline the workflow — reviewer confirms relevant systems in one action rather than one at a time
- UI should be the differentiator — this is a demo project, so visual quality matters

</specifics>

<deferred>
## Deferred Ideas

- Batch approve/reject — future enhancement after v1 validates one-at-a-time review
- Priority/severity classification on obligations (LEGAL-03) — v2 requirement
- Real-time updates via SSE (PIPE-02) — v2 requirement

</deferred>

---

*Phase: 03-legal-gate-action-items-and-rag-corpus*
*Context gathered: 2026-03-03*
