# Requirements: RIDE

**Defined:** 2026-03-02
**Core Value:** Turn any financial regulatory document into approved, system-mapped business action items through a transparent AI pipeline with two human-in-the-loop gates — legal approval and engineering confirmation — so compliance never becomes a black box.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Document Ingestion

- [ ] **INGEST-01**: User can upload a regulatory PDF document
- [ ] **INGEST-02**: System extracts structure-preserving Markdown from PDF (tables, sections, headings intact)

### AI Obligation Extraction

- [ ] **EXTRACT-01**: System extracts structured obligations from regulatory document with verbatim source quotes
- [ ] **EXTRACT-02**: System displays transparent chain-of-thought reasoning per extracted obligation
- [ ] **EXTRACT-03**: System flags ambiguous regulatory language that requires human judgment

### Legal Review Gate

- [ ] **LEGAL-01**: Legal/compliance reviewer can approve or reject each extracted obligation with source quotes displayed
- [ ] **LEGAL-02**: Every approve/reject action is logged to an immutable audit trail

### Action Item Generation

- [ ] **ACTION-01**: Approved obligations are transformed into structured business action items

### RAG System Mapping

- [ ] **RAG-01**: System suggests affected internal systems using RAG against mock Wealthsimple service documentation
- [ ] **RAG-02**: Mock service corpus includes realistic services (KYC, Trading Engine, Tax Reporting, etc.)

### Engineering Review Gate

- [ ] **ENG-01**: Engineer can confirm, correct, or reassign AI-suggested system mappings
- [ ] **ENG-02**: Engineer overrides are logged with reason to audit trail

### Impact Analysis

- [ ] **IMPACT-01**: Final systems-x-obligations matrix shows confirmed mappings as the demo deliverable

### Architecture & Demo

- [ ] **ARCH-01**: Architecture diagrams demonstrate systems thinking and event-driven pipeline design
- [ ] **ARCH-02**: One polished end-to-end happy path flow suitable for 2-3 minute demo video

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
| INGEST-01 | — | Pending |
| INGEST-02 | — | Pending |
| EXTRACT-01 | — | Pending |
| EXTRACT-02 | — | Pending |
| EXTRACT-03 | — | Pending |
| LEGAL-01 | — | Pending |
| LEGAL-02 | — | Pending |
| ACTION-01 | — | Pending |
| RAG-01 | — | Pending |
| RAG-02 | — | Pending |
| ENG-01 | — | Pending |
| ENG-02 | — | Pending |
| IMPACT-01 | — | Pending |
| ARCH-01 | — | Pending |
| ARCH-02 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
