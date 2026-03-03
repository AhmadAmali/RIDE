# Phase 4: Engineering Gate, Impact Matrix, and Demo - Research

**Researched:** 2026-03-02
**Domain:** Engineering review UI, impact matrix visualization, architecture diagrams, end-to-end demo
**Confidence:** HIGH

## Summary

Phase 4 is the final delivery phase for RIDE v1. It builds three deliverables on top of the fully operational pipeline from Phases 1-3: (1) an engineering review gate where engineers confirm/correct/reassign AI-suggested system mappings with RAG evidence displayed, (2) a systems-x-obligations impact matrix showing all confirmed mappings, and (3) architecture diagrams plus a polished end-to-end demo flow.

The codebase already has the complete event-driven pipeline (upload -> parse -> extract -> legal review -> action item generation -> RAG mapping), the SystemMapping model with `confirmed`, `engineer_note`, and `confidence_score` fields, and a proven UI pattern (legal review split-panel with ObligationCard). The engineering gate follows the exact same pattern: list items needing review, display evidence, provide confirm/correct/reassign actions with audit logging. The impact matrix is a new read-only visualization that aggregates confirmed SystemMapping rows into a cross-reference grid.

**Primary recommendation:** Replicate the legal review pattern (atomic PATCH + AuditLog, split-panel UI with evidence) for the engineering gate, extend SystemMapping with a `matched_chunk` text column to persist RAG evidence at mapping time, and build the impact matrix as a server-rendered aggregate query with a simple HTML table grid.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENG-01 | Engineer can confirm, correct, or reassign AI-suggested system mappings | New PATCH endpoint on `/api/system-mappings/{id}/review`, new EngineeringReviewPanel UI mirroring legal review pattern, SystemMapping.matched_chunk field for RAG evidence display |
| ENG-02 | Engineer overrides are logged with reason to audit trail | Atomic dual-write pattern from obligations.py (session.begin() wrapping both SystemMapping update and AuditLog insert) |
| IMPACT-01 | Final systems-x-obligations matrix shows confirmed mappings as demo deliverable | New `/api/impact-matrix` aggregate endpoint joining SystemMapping -> ActionItem -> Obligation -> Document, frontend grid/table component |
| ARCH-01 | Architecture diagrams demonstrate systems thinking and event-driven pipeline design | Mermaid diagrams (pipeline flow, system context, data model) committed as .md files, rendered in docs/ |
| ARCH-02 | One polished end-to-end happy path flow suitable for 2-3 minute demo video | Integration test script or documented manual walkthrough: upload PDF -> legal review -> engineering confirm -> view impact matrix |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | Backend API framework | Already used; engineering review follows identical pattern to legal review |
| SQLAlchemy async | >=2.0.0 | ORM with async session support | All models use this; SystemMapping already defined |
| Next.js 15 | ^15.1.0 | Frontend framework | Already used; new pages follow existing app router pattern |
| shadcn/ui | latest | UI components (Card, Badge, Button, ScrollArea, ResizablePanel) | Already imported; engineering review UI reuses same components |
| Tailwind CSS | ^3.4.0 | Styling | Already configured with Wealthsimple-inspired design tokens |
| aiokafka | >=0.11.0 | Kafka producer/consumer | SYSTEM_MAPPING_CONFIRMED topic already defined in KafkaTopic enum |
| qdrant-client[fastembed] | >=1.17.0 | Vector search for RAG | Already used by RagMapperWorker |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | No new backend dependencies needed |
| None | - | - | No new frontend dependencies needed (all shadcn components and patterns already available) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML table for impact matrix | AG Grid / TanStack Table | Over-engineering for a read-only cross-reference grid; HTML table with Tailwind is simpler and sufficient for demo |
| Mermaid for architecture diagrams | draw.io / Excalidraw | Mermaid is code-as-diagram, lives in version control, renders in GitHub markdown natively |
| Alembic migration for matched_chunk | Raw SQL | Alembic is already set up and matches existing pattern |

**Installation:**
No new packages required. All dependencies are already in `backend/requirements.txt` and `frontend/package.json`.

## Architecture Patterns

### Recommended Project Structure (new files only)
```
backend/ride/
  api/routes/
    system_mappings.py        # NEW: Engineering review endpoints
    impact_matrix.py          # NEW: Impact matrix aggregate endpoint
  models/
    system_mapping.py         # MODIFY: Add matched_chunk column
  workers/
    rag_mapper_worker.py      # MODIFY: Persist matched_chunk from Qdrant result
backend/alembic/versions/
    xxxx_add_matched_chunk.py # NEW: Migration for matched_chunk column

frontend/src/
  app/
    engineering/[documentId]/
      page.tsx                # NEW: Engineering review page
    impact/
      page.tsx                # NEW: Impact matrix page
  components/
    engineering/
      SystemMappingCard.tsx   # NEW: Card for each system mapping with evidence
      EngineeringPanel.tsx    # NEW: Split-panel for engineering review
    impact/
      ImpactMatrix.tsx        # NEW: Systems-x-obligations grid
  lib/
    api.ts                    # MODIFY: Add engineering review + impact matrix API calls
    types.ts                  # MODIFY: Add SystemMapping, ActionItem, ImpactCell types

docs/
  architecture/
    pipeline-flow.md          # NEW: Mermaid diagram of event-driven pipeline
    system-context.md         # NEW: System context diagram showing all services
```

### Pattern 1: Engineering Review Endpoint (mirrors legal review)
**What:** PATCH endpoint that confirms/corrects/reassigns a SystemMapping with atomic audit logging
**When to use:** For ENG-01 and ENG-02
**Example:**
```python
# Source: Existing pattern from backend/ride/api/routes/obligations.py
class EngineeringReviewRequest(BaseModel):
    action: Literal["confirmed", "corrected", "reassigned"]
    actor: str = "engineer"
    corrected_system: str | None = None  # Only for "corrected" or "reassigned"
    reason: str | None = None  # Required for corrected/reassigned

@router.patch("/{mapping_id}/review")
async def review_mapping(mapping_id: uuid.UUID, body: EngineeringReviewRequest, request: Request) -> dict:
    async with async_session_maker() as session:
        async with session.begin():
            # Fetch mapping
            result = await session.execute(
                select(SystemMapping).where(SystemMapping.id == mapping_id)
            )
            mapping = result.scalar_one_or_none()
            if not mapping:
                raise HTTPException(status_code=404)
            if mapping.confirmed:
                raise HTTPException(status_code=409, detail="Already confirmed")

            # Apply action
            mapping.confirmed = True
            if body.action in ("corrected", "reassigned"):
                old_system = mapping.system_name
                mapping.system_name = body.corrected_system
                mapping.engineer_note = body.reason
                mapping.suggested_by = "engineer"

            # Atomic audit log
            session.add(AuditLog(
                entity_type="system_mapping",
                entity_id=mapping_id,
                action=body.action,
                actor=body.actor,
                metadata_={"previous_system": old_system} if body.action != "confirmed" else None,
            ))
        # Emit Kafka event after commit
        await request.app.state.kafka_producer.send(
            KafkaTopic.SYSTEM_MAPPING_CONFIRMED,
            {"mapping_id": str(mapping_id), "action_item_id": str(mapping.action_item_id)},
        )
    return {... mapping fields ...}
```

### Pattern 2: Impact Matrix Aggregate Query
**What:** SQL query joining SystemMapping -> ActionItem -> Obligation -> Document to produce a systems-x-obligations grid
**When to use:** For IMPACT-01
**Example:**
```python
# Aggregate: For each (system_name, obligation_id) pair where confirmed=True,
# return the mapping details. Frontend pivots this into a grid.
@router.get("/api/impact-matrix")
async def get_impact_matrix(document_id: uuid.UUID | None = None, db: AsyncSession = Depends(get_db)) -> dict:
    query = (
        select(
            SystemMapping.system_name,
            Obligation.id.label("obligation_id"),
            Obligation.text.label("obligation_text"),
            SystemMapping.confidence_score,
            SystemMapping.suggested_by,
            SystemMapping.engineer_note,
        )
        .join(ActionItem, SystemMapping.action_item_id == ActionItem.id)
        .join(Obligation, ActionItem.obligation_id == Obligation.id)
        .where(SystemMapping.confirmed == True)
    )
    if document_id:
        query = query.join(Document, Obligation.document_id == Document.id)
        query = query.where(Document.id == document_id)

    results = await db.execute(query)
    rows = results.all()

    # Return flat list; frontend pivots into grid
    return {
        "systems": sorted(set(r.system_name for r in rows)),
        "obligations": [...],
        "cells": [{"system": r.system_name, "obligation_id": str(r.obligation_id), ...} for r in rows],
    }
```

### Pattern 3: RAG Evidence Display
**What:** Store the matched Qdrant text chunk alongside the SystemMapping so the engineering review UI can display what was matched
**When to use:** For ENG-01 (RAG evidence display requirement)
**Key insight:** The `RagMapperWorker` currently only stores `system_name` and `confidence_score` from Qdrant results. The Qdrant `query()` response includes a `.document` field containing the original indexed text chunk. This must be persisted into a new `matched_chunk` column on SystemMapping so the engineering review UI can display it without re-querying Qdrant.

```python
# Modification to RagMapperWorker.process():
mapping = SystemMapping(
    action_item_id=uuid.UUID(action_item_id),
    system_name=result.metadata.get("service", "unknown"),
    confidence_score=result.score,
    matched_chunk=result.document,  # NEW: persist the matched text chunk
    suggested_by="rag",
    confirmed=False,
)
```

### Pattern 4: Frontend Navigation Flow
**What:** Document list -> Legal Review -> Engineering Review -> Impact Matrix
**When to use:** For ARCH-02 (end-to-end demo flow)
**Key insight:** The current document list page links to `/review/[documentId]` for legal review. Phase 4 needs to add an engineering review link (visible after all obligations are approved) and an impact matrix link (visible after all mappings are confirmed).

### Anti-Patterns to Avoid
- **Re-querying Qdrant at display time:** Do NOT query Qdrant when rendering the engineering review page. Store matched chunks at mapping time in PostgreSQL. Qdrant is an indexing engine, not a display-time database.
- **Client-side matrix computation:** The impact matrix join should happen in SQL, not in the browser. Return pre-joined data from the API.
- **Separate migration for each model change:** Bundle the `matched_chunk` column addition into a single Alembic migration. Only one schema change is needed for this phase.
- **Over-complicating the matrix UI:** A simple HTML `<table>` with Tailwind styling is sufficient. No need for a data grid library for a read-only cross-reference view.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Architecture diagrams | Custom SVG or image editor | Mermaid markdown syntax | Version-controlled, renders in GitHub, easy to edit |
| Impact matrix grid | Custom CSS Grid layout | HTML `<table>` with Tailwind | Tables are semantically correct for cross-reference grids; accessibility built in |
| Audit trail | Custom logging | AuditLog model (already exists) | Pattern proven in Phase 3 legal review; entity_type + entity_id + JSONB metadata covers all cases |
| Idempotent review | Custom state machine | Database status check (409 Conflict) | Pattern already established in obligation review endpoint |

**Key insight:** Phase 4 is deliberately NOT introducing new infrastructure. Every pattern (atomic audit logging, split-panel UI, Kafka event emission, Qdrant queries) was established in Phases 1-3. The work is wiring these patterns to the engineering review domain and building one new visualization (the impact matrix).

## Common Pitfalls

### Pitfall 1: Missing RAG Evidence at Display Time
**What goes wrong:** RagMapperWorker stores only `system_name` and `confidence_score`. When the engineering review UI tries to show "why this system was suggested," there's no evidence text available.
**Why it happens:** The Qdrant query result's `.document` field (matched chunk text) is not persisted.
**How to avoid:** Add `matched_chunk: Mapped[str | None] = mapped_column(Text, nullable=True)` to SystemMapping model. Modify RagMapperWorker to store `result.document` in this field. Create Alembic migration.
**Warning signs:** UI placeholder text saying "evidence not available" or empty evidence panels.

### Pitfall 2: SystemMapping Has No updated_at Column
**What goes wrong:** After an engineer confirms/corrects a mapping, there is no timestamp showing when the review happened. The `created_at` reflects when the RAG mapper created the row, not when the engineer acted.
**Why it happens:** The initial schema only has `created_at` on SystemMapping.
**How to avoid:** Add `reviewed_at` or `updated_at` column to SystemMapping in the same migration that adds `matched_chunk`. Set it via `func.now()` on update.
**Warning signs:** Audit log has the timestamp but the mapping record itself doesn't reflect review time.

### Pitfall 3: Engineering Review Before All Obligations Approved
**What goes wrong:** An engineer tries to review system mappings while legal review is still in progress. New action items (and thus new system mappings) could appear after the engineer has already started reviewing.
**How to avoid:** Gate the engineering review UI to only show for documents where ALL obligations are in a terminal state (approved or rejected). This is a frontend guard, not a backend one — the backend should still accept reviews on any confirmed=False mapping.
**Warning signs:** Mapping count changes during engineering review session.

### Pitfall 4: Impact Matrix Shows Stale Data
**What goes wrong:** The impact matrix displays AI-suggested mappings instead of confirmed mappings.
**Why it happens:** Querying SystemMapping without filtering on `confirmed=True`.
**How to avoid:** The impact matrix API endpoint MUST filter on `confirmed=True`. Requirement IMPACT-01 explicitly states "confirmed mappings (including overrides) are reflected -- not just the AI's initial suggestions."
**Warning signs:** Matrix shows systems that the engineer explicitly corrected away from.

### Pitfall 5: Forgetting to Wire the New Router
**What goes wrong:** New endpoints return 404 because the router was created but not added to `api/main.py`.
**Why it happens:** FastAPI requires `app.include_router(router)` for each new router module.
**How to avoid:** Checklist: create route file, import in main.py, add `app.include_router()`. Follow the exact pattern used for `documents_router` and `obligations_router`.
**Warning signs:** Frontend gets 404 on new API calls.

### Pitfall 6: Alembic Migration on Running Containers
**What goes wrong:** `alembic upgrade head` runs at container startup (already configured in docker-compose). Adding a new migration file is sufficient -- no extra deployment step needed.
**Why it happens:** This is actually a NON-pitfall. The existing docker-compose command `bash -c "alembic upgrade head && uvicorn..."` handles this automatically.
**How to avoid:** Just add the migration file. The existing startup command will apply it.

## Code Examples

Verified patterns from the existing codebase:

### Atomic Dual-Write for Engineering Review (from obligations.py pattern)
```python
# Source: backend/ride/api/routes/obligations.py lines 85-111
# Same pattern for system mapping review
async with async_session_maker() as session:
    async with session.begin():
        # 1. Fetch and validate
        result = await session.execute(
            select(SystemMapping).where(SystemMapping.id == mapping_id)
        )
        mapping = result.scalar_one_or_none()
        # 2. Update mapping
        mapping.confirmed = True
        # 3. Insert audit log in same transaction
        session.add(AuditLog(
            entity_type="system_mapping",
            entity_id=mapping_id,
            action=body.action,
            actor=body.actor,
            metadata_={...},
        ))
    # Transaction committed here
```

### Split-Panel UI Pattern (from ReviewPanel.tsx)
```tsx
// Source: frontend/src/components/review/ReviewPanel.tsx
<ResizablePanelGroup direction="horizontal" className="h-full">
  <ResizablePanel defaultSize={50} minSize={30}>
    {/* Left: Action item description + RAG evidence */}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50} minSize={30}>
    <ScrollArea className="h-full">
      {/* Right: SystemMapping cards with confirm/correct/reassign buttons */}
    </ScrollArea>
  </ResizablePanel>
</ResizablePanelGroup>
```

### API Client Pattern (from api.ts)
```typescript
// Source: frontend/src/lib/api.ts
// SSR/browser dual URL pattern
const API_URL =
  typeof window !== "undefined"
    ? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_URL || "http://backend:8000";

export async function reviewSystemMapping(
  mappingId: string,
  action: "confirmed" | "corrected" | "reassigned",
  correctedSystem?: string,
  reason?: string
): Promise<SystemMapping> {
  const res = await fetch(`${API_URL}/api/system-mappings/${mappingId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, actor: "engineer", corrected_system: correctedSystem, reason }),
  });
  if (res.status === 409) throw new Error("This mapping has already been reviewed.");
  if (!res.ok) throw new Error(`Review failed: ${res.status}`);
  return res.json();
}
```

### Optimistic UI Update Pattern (from ReviewPage)
```typescript
// Source: frontend/src/app/review/[documentId]/page.tsx lines 39-47
const handleReview = useCallback(
  (mappingId: string, newAction: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.id === mappingId ? { ...m, confirmed: true, ...updates } : m
      )
    );
  },
  []
);
```

### Kafka Event Emission After Commit (from obligations.py)
```python
# Source: backend/ride/api/routes/obligations.py lines 126-133
# Emit Kafka event AFTER transaction commits
await request.app.state.kafka_producer.send(
    KafkaTopic.SYSTEM_MAPPING_CONFIRMED,
    {"mapping_id": str(mapping_id), "action_item_id": str(mapping.action_item_id)},
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Re-query Qdrant at display time | Persist matched_chunk at mapping time | This phase | Avoids Qdrant dependency at UI render; simpler, faster |
| Separate audit service | Same-transaction AuditLog insert | Phase 1 design | Atomic guarantees without distributed transactions |
| Complex data grid libraries | HTML table with Tailwind | This phase | Appropriate complexity for read-only cross-reference |

**Patterns confirmed stable:**
- FastAPI + SQLAlchemy async session pattern (proven across 6 plans)
- shadcn/ui Card + Badge + Button pattern (proven in ObligationCard)
- ResizablePanel split-panel pattern (proven in ReviewPanel)
- Atomic dual-write with session.begin() (proven in legal review)
- Kafka topic enum + BaseProducer.send() (proven across all workers)

## Data Model Changes

### SystemMapping Model Additions
```python
# Two new columns needed:
matched_chunk: Mapped[str | None] = mapped_column(Text, nullable=True)  # RAG evidence text
reviewed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # When engineer acted
```

### Alembic Migration
```python
# Single migration adding both columns
op.add_column('system_mappings', sa.Column('matched_chunk', sa.Text(), nullable=True))
op.add_column('system_mappings', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
```

### New TypeScript Types
```typescript
export interface ActionItem {
  id: string;
  obligation_id: string;
  description: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
}

export interface SystemMapping {
  id: string;
  action_item_id: string;
  system_name: string;
  confidence_score: number | null;
  matched_chunk: string | null;
  suggested_by: string;
  confirmed: boolean;
  engineer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ImpactMatrixCell {
  system_name: string;
  obligation_id: string;
  obligation_text: string;
  confidence_score: number | null;
  suggested_by: string;
  engineer_note: string | null;
}

export interface ImpactMatrix {
  systems: string[];  // Column headers (e.g., "kyc", "trading_engine")
  obligations: { id: string; text: string }[];  // Row headers
  cells: ImpactMatrixCell[];  // Sparse cells where mapping exists
}
```

## API Endpoint Design

### Engineering Review Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/system-mappings?document_id={id}` | List all system mappings for a document (joins through ActionItem -> Obligation -> Document) |
| GET | `/api/system-mappings/{id}` | Get single mapping with matched_chunk evidence |
| PATCH | `/api/system-mappings/{id}/review` | Confirm, correct, or reassign a mapping |
| GET | `/api/action-items?document_id={id}` | List action items for a document (needed for engineering review context) |

### Impact Matrix Endpoint
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/impact-matrix?document_id={id}` | Aggregated systems-x-obligations grid data |

### Available Services for Reassignment
The mock corpus includes 6 services: `kyc`, `trading_engine`, `tax_reporting`, `compliance_reporting`, `auth`, `notifications`. These should be presented as a dropdown when an engineer chooses "reassign."

## Architecture Diagram Content

### Diagram 1: Event-Driven Pipeline Flow
Shows the Kafka topic chain: DOCUMENT_UPLOADED -> ParseWorker -> DOCUMENT_PARSED -> ExtractWorker -> OBLIGATION_EXTRACTED -> (Legal Review Gate) -> OBLIGATION_APPROVED -> ActionItemWorker -> ACTION_ITEM_GENERATED -> RagMapperWorker -> SYSTEM_MAPPING_PROPOSED -> (Engineering Review Gate) -> SYSTEM_MAPPING_CONFIRMED -> Impact Matrix

### Diagram 2: System Context
Shows: User -> Next.js Frontend -> FastAPI Backend -> PostgreSQL / Kafka / Qdrant
Plus: Workers as separate async processes within the FastAPI lifespan

### Diagram 3: Data Model / Entity Relationships
Shows: Document 1:N Obligation N:1 ActionItem 1:N SystemMapping + AuditLog (entity polymorphic)

All three diagrams should use Mermaid syntax for version control and GitHub rendering.

## Demo Flow (ARCH-02)

### End-to-End Happy Path
1. **Upload:** User uploads a regulatory PDF via the dropzone
2. **Pipeline:** System parses -> extracts obligations -> shows in document list as "Ready for Review"
3. **Legal Review:** User clicks document -> reviews obligations (approve 3-4, reject 1) in split-panel UI
4. **Background Processing:** Approved obligations -> action items -> RAG system mapping (automatic)
5. **Engineering Review:** User navigates to engineering review -> sees system suggestions with RAG evidence -> confirms most, corrects one (changes system assignment with reason)
6. **Impact Matrix:** User views the systems-x-obligations matrix showing all confirmed mappings
7. **Audit Trail:** Every action (legal approve/reject, engineer confirm/correct) is logged

**Demo timing estimate:**
- Upload + wait for pipeline: 30 seconds
- Legal review (4 obligations): 30 seconds
- Wait for action items + RAG mapping: 15 seconds
- Engineering review (3-4 mappings): 30 seconds
- Impact matrix view: 15 seconds
- Total: ~2 minutes (fits 2-3 minute target)

### Demo Document
The existing test regulatory document (whatever PDF was used during Phase 2-3 development) should be validated to produce at least 3-4 obligations that map to at least 2 different systems. If no suitable document exists, one should be created/selected during this phase.

## Navigation Design

### Suggested Page Flow
```
/ (Document List)
  -> /review/[documentId] (Legal Review - existing)
  -> /engineering/[documentId] (Engineering Review - NEW)
  -> /impact (Impact Matrix - NEW)
```

### Document List Page Enhancements
The document list page currently shows status as "Uploaded" | "Parsed" | "Ready for Review". Phase 4 needs to extend this with additional states or add navigation links for documents that have completed legal review and RAG mapping. Options:
- Add a "Ready for Engineering" link when all obligations are in terminal state AND system mappings exist
- Add a separate "View Impact Matrix" link when all mappings are confirmed

## Open Questions

1. **Document status tracking through engineering gate**
   - What we know: Document.status currently tracks "uploaded" -> "parsed" -> "extracted". There's no status for "legal review complete" or "engineering review complete."
   - What's unclear: Should we add more document statuses or track this via query (check if all obligations are approved and all mappings are confirmed)?
   - Recommendation: Use query-based status derivation rather than adding more status values. Keep the Document model simple. The frontend can query obligations and mappings to determine the document's progress stage.

2. **Handling documents with zero system mappings**
   - What we know: If all obligations are rejected, no action items are generated, and no system mappings exist.
   - What's unclear: Should the engineering review page handle this edge case, or should navigation to engineering review be hidden?
   - Recommendation: Hide the engineering review link for documents with zero system mappings. Show a "No systems affected" message on the impact matrix if no confirmed mappings exist.

3. **Re-running the demo**
   - What we know: The pipeline is not idempotent -- uploading the same PDF creates a new document.
   - What's unclear: For the demo, is it acceptable to just upload a fresh copy?
   - Recommendation: Yes, fresh upload is fine for demo purposes. No need to build reset functionality.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `backend/ride/models/system_mapping.py` -- confirmed SystemMapping schema
- Existing codebase analysis: `backend/ride/workers/rag_mapper_worker.py` -- confirmed Qdrant query pattern and gap (no matched_chunk persistence)
- Existing codebase analysis: `backend/ride/api/routes/obligations.py` -- confirmed atomic dual-write pattern for review endpoints
- Existing codebase analysis: `frontend/src/components/review/` -- confirmed split-panel UI pattern
- Existing codebase analysis: `backend/ride/kafka/topics.py` -- confirmed SYSTEM_MAPPING_CONFIRMED and IMPACT_MATRIX_READY topics already defined
- Existing codebase analysis: `backend/ride/api/main.py` -- confirmed lifespan pattern and router registration

### Secondary (MEDIUM confidence)
- Qdrant query() response structure -- `.document` field contains original indexed text based on qdrant-client fastembed add/query API contract

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - all patterns proven in Phases 1-3, engineering gate is a direct mirror of legal gate
- Pitfalls: HIGH - identified from direct codebase analysis of existing gaps (missing matched_chunk, missing reviewed_at)
- Demo flow: MEDIUM - timing estimate is approximate; depends on Claude API response time and Kafka consumer lag

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- no fast-moving dependencies)
