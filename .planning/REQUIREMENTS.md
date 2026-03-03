# Requirements: RIDE

**Defined:** 2026-03-02
**Core Value:** Turn any financial regulatory document into approved, system-mapped business action items through a transparent AI pipeline with two human-in-the-loop gates — legal approval and engineering confirmation — so compliance never becomes a black box.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Document Ingestion

- [x] **INGEST-01**: User can upload a regulatory PDF document
- [x] **INGEST-02**: System extracts structure-preserving Markdown from PDF (tables, sections, headings intact)

### AI Obligation Extraction

- [x] **EXTRACT-01**: System extracts structured obligations from regulatory document with verbatim source quotes
- [x] **EXTRACT-02**: System displays transparent chain-of-thought reasoning per extracted obligation
- [x] **EXTRACT-03**: System flags ambiguous regulatory language that requires human judgment

### Legal Review Gate

- [x] **LEGAL-01**: Legal/compliance reviewer can approve or reject each extracted obligation with source quotes displayed
- [x] **LEGAL-02**: Every approve/reject action is logged to an immutable audit trail

### Action Item Generation

- [x] **ACTION-01**: Approved obligations are transformed into structured business action items

### RAG System Mapping

- [x] **RAG-01**: System suggests affected internal systems using RAG against mock Wealthsimple service documentation
- [x] **RAG-02**: Mock service corpus includes realistic services (KYC, Trading Engine, Tax Reporting, etc.)

### Engineering Review Gate

- [x] **ENG-01**: Engineer can confirm, correct, or reassign AI-suggested system mappings
- [x] **ENG-02**: Engineer overrides are logged with reason to audit trail

### Impact Analysis

- [x] **IMPACT-01**: Final systems-x-obligations matrix shows confirmed mappings as the demo deliverable

### Architecture & Demo

- [x] **ARCH-01**: Architecture diagrams demonstrate systems thinking and event-driven pipeline design
- [x] **ARCH-02**: One polished end-to-end happy path flow suitable for 2-3 minute demo video

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Document Ingestion

- **INGEST-03**: User can paste a URL to ingest regulatory documents from web
- **INGEST-04**: System compares document versions for regulatory amendment tracking

### AI Extraction

- **EXTRACT-04**: Confidence scoring per extracted obligation guides reviewer attention

### Legal Gate

- **LEGAL-03**: Priority/severity classification on each obligation

### System Mapping

- **RAG-03**: Multi-system mapping per action item (single regulation touches multiple services)
- **RAG-04**: Retrieval evidence display showing which internal doc chunks matched and why

### Pipeline

- **PIPE-01**: Pipeline status view showing stage-by-stage progress as documents flow through
- **PIPE-02**: Real-time updates via SSE instead of polling

### Integration

- **INTEG-01**: Engineering ticket creation (Jira/Linear) from confirmed impact analysis
- **INTEG-02**: Real regulatory feed monitoring (Bloomberg Law, FINTRAC RSS)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autonomous obligation approval | Legally inadvisable in financial services; contradicts HITL thesis |
| Code generation or PR creation | Dangerous without human oversight; prototype stops at impact analysis |
| Mobile responsiveness | Compliance work is desktop-dominated at this information density |
| Multi-tenancy and authentication | Validate single-org value first |
| Real-time multi-user collaboration | Sequential workflow is correct for compliance accountability |
| GRC tool integration (ServiceNow, Archer) | Validate standalone value before integration complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 2 | Complete (02-01) |
| INGEST-02 | Phase 2 | Complete (02-01) |
| EXTRACT-01 | Phase 2 | Complete (02-02) |
| EXTRACT-02 | Phase 2 | Complete (02-02) |
| EXTRACT-03 | Phase 2 | Complete (02-02) |
| LEGAL-01 | Phase 3 | Complete |
| LEGAL-02 | Phase 3 | Complete |
| ACTION-01 | Phase 3 | Complete |
| RAG-01 | Phase 3 | Complete |
| RAG-02 | Phase 3 | Complete |
| ENG-01 | Phase 4 | Complete (04-01) |
| ENG-02 | Phase 4 | Complete (04-01) |
| IMPACT-01 | Phase 4 | Complete (04-02) |
| ARCH-01 | Phase 4 | Complete (04-02) |
| ARCH-02 | Phase 4 | Complete (04-02) |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-03 after 04-02 completion — IMPACT-01, ARCH-01, ARCH-02 marked complete. All v1 requirements complete.*
