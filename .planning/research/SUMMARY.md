# Project Research Summary

**Project:** RIDE — Regulatory Integrated Development Environment
**Domain:** Regulatory AI document processing pipeline (Fintech / Legal AI)
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

RIDE is a regulatory AI compliance pipeline that processes regulatory documents (PDFs) through an automated extraction pipeline, two human-in-the-loop review gates, and a RAG-based internal system mapper to produce a final impact matrix linking regulatory obligations to specific internal engineering systems. The product is novel: existing RegTech tools (Harvey, Ascent, Thomson Reuters CoCounsel) handle obligation extraction and legal review, but none bridge the gap to engineering-side impact analysis. RIDE's dual-gate model and systems-x-obligations matrix are genuinely differentiated in the market.

The recommended architecture is an event-driven pipeline: Next.js frontend talks to a FastAPI API gateway, which produces to Apache Kafka (project-prescribed). Separate Python workers consume from Kafka to handle PDF ingestion (pymupdf4llm), AI obligation extraction (Claude Sonnet 4.6 with structured JSON output), action item generation, and RAG system mapping (LlamaIndex + Qdrant). PostgreSQL owns pipeline state; Kafka carries transition events. The frontend polls state via REST or subscribes to SSE for live updates. This is demonstrably production-viable architecture while remaining buildable as a prototype.

The top risks are: (1) LLM hallucinations in obligation extraction — mitigated by requiring verbatim source quotes in the structured output schema and displaying them at the legal gate; (2) PDF structure destruction undermining extraction quality — mitigated by using pymupdf4llm for LLM-optimized Markdown conversion with table preservation; (3) human gates becoming checkbox theater — mitigated by designing gate UIs that surface AI evidence (source quotes, RAG retrieval context) alongside approval controls; and (4) Kafka complexity overwhelming development velocity — mitigated by running minimal single-node KRaft mode via Docker Compose with simple topic topology. Address all four before building downstream features.

## Key Findings

### Recommended Stack

The stack centers on Python 3.12 with FastAPI as the API gateway and async event processing backbone, confluent-kafka (2.13.0, librdkafka-backed) for Kafka integration, and the Anthropic Python SDK (0.84.0) for Claude API access with structured JSON output via `output_config.format`. For document parsing, pymupdf4llm (0.3.4, AGPL-licensed — flag for production) produces LLM-optimized Markdown from PDFs, with pdfplumber as a fallback for complex tables. RAG uses LlamaIndex (0.14.15) for orchestration backed by Qdrant (1.17.x) as the vector store, with sentence-transformers for local embeddings. The frontend is Next.js 15.x (hold at 15, not 16) with Tailwind CSS v4 and shadcn/ui for professional dashboard components. Zustand handles frontend state. All infrastructure (Kafka in KRaft mode, Qdrant) runs via Docker Compose for local development.

**Core technologies:**
- Next.js 15.x: Frontend framework with App Router — Server Components for fast gate views, client components for interactive approval forms
- FastAPI 0.115.x: API gateway bridging Kafka and frontend — handles gate actions, SSE events, Pydantic validation
- Claude Sonnet 4.6 via anthropic 0.84.0: Obligation extraction with `output_config.format` JSON schema — structured output eliminates parsing heuristics
- confluent-kafka 2.13.0: Production-grade Kafka client (librdkafka) — superior to kafka-python or aiokafka for reliability
- pymupdf4llm 0.3.4: Structure-preserving PDF-to-Markdown conversion — purpose-built for LLM pipelines; tables as Markdown, not flat text
- LlamaIndex 0.14.15 + Qdrant 1.17.x: RAG orchestration and vector store — 40% faster retrieval than LangChain for pure document retrieval
- shadcn/ui + Tailwind CSS v4: Professional dashboard components — unstyled Radix UI primitives, full ownership, correct for legal/fintech aesthetics

**What not to use:** PyPDF2 (deprecated), kafka-python (poor performance), ChromaDB in production (not hardened), Redux (overkill for prototype state), LangChain for pure RAG (heavier and slower than LlamaIndex), Next.js 16 (React 19.2 breaking changes not yet stable).

### Expected Features

Research confirms a strict dependency chain: document ingestion must precede extraction, extraction must precede the legal gate, RAG mapping depends on legal-approved obligations, and the engineering gate depends on RAG output. The systems-x-obligations matrix is the terminal output that synthesizes all prior steps.

**Must have (table stakes):**
- Document ingestion via PDF upload — universal entry point, every pipeline stage depends on it
- AI obligation extraction with inline citations — core value; legal professionals evaluate trust on citation quality
- Transparent reasoning display (chain-of-thought per obligation) — Harvey design principle; non-negotiable for regulated industry trust
- Legal review gate with approve/reject/priority and audit log — financially regulated environments require human sign-off by law (FINRA 2026)
- Obligation-to-action-item transformation — bridges legal approval to engineering action
- RAG-based internal system mapper with mock service corpus — the novel technical differentiator
- Engineering review gate with confirm/correct/reassign and audit log — unique in market; second HITL gate
- Final systems-x-obligations impact matrix — the demo deliverable; shows full pipeline output
- Pipeline status view — lets reviewers track document progress through all stages
- Priority/severity classification — legal reviewers must triage; not all obligations are equal urgency

**Should have (competitive differentiators):**
- Ambiguity flagging per obligation (23.4% of regulatory requirements require human judgment — show this honestly)
- Confidence scoring per obligation — guides reviewer attention to low-confidence extractions
- Document version comparison — for regulatory amendment tracking (v1.x trigger: when real change management use case is validated)

**Defer (v2+):**
- Real regulatory feed monitoring (requires vendor data relationships: Bloomberg Law, FINTRAC RSS)
- Multi-tenancy and authentication — validates single-org value first
- Real-time multi-user collaboration — sequential workflow is correct for compliance accountability
- Engineering ticket creation (Jira/Linear) — validate impact analysis accuracy before automating downstream action
- GRC tool integration (ServiceNow, Archer) — validate standalone value before integration complexity

**Anti-features to avoid:** Fully autonomous obligation approval (legally inadvisable, contradicts HITL thesis), code generation or PR creation (dangerous and out of scope), mobile responsiveness (compliance work is desktop-dominated at this information density).

### Architecture Approach

The architecture follows a topic-per-pipeline-stage event-driven pattern: each state transition publishes to a distinct Kafka topic, independent workers consume per stage, and PostgreSQL is the authoritative state store (Kafka is not a database — never query it for current document state). Workers are isolated processes: ingestion worker, AI engine worker, action worker, RAG worker — each with its own consumer group for independent scaling and failure isolation. Claude API calls happen exclusively inside workers (never in FastAPI route handlers) to avoid blocking the event loop during 5-15 second inference calls. Chroma/Qdrant lives only in the RAG worker process to avoid concurrent access corruption. The frontend uses 2-second polling for prototype sufficiency, with SSE as the production upgrade path.

**Major components:**
1. Next.js Frontend — upload dashboard, legal gate UI, engineering gate UI, impact analysis view; EventSource for SSE pipeline updates
2. FastAPI API Gateway — REST endpoints for all gate actions, Kafka producer, SSE bridge consuming pipeline status topic, Pydantic validation layer
3. Ingestion Worker — pymupdf4llm PDF-to-Markdown, publishes to `ride.documents.parsed`
4. AI Engine Worker — Claude structured output obligation extraction with source quotes, publishes to `ride.obligations.extracted`
5. Action Worker — obligation-to-action-item transformation via Claude, publishes to `ride.actions.generated`
6. RAG System Mapper Worker — LlamaIndex + Qdrant similarity search, Claude synthesis of system suggestions, publishes to `ride.mappings.suggested`
7. PostgreSQL — pipeline state machine authority, obligations, action items, mappings, audit log
8. Qdrant (Docker) — vector store for mock service corpus; persistent volume mount from startup
9. Kafka (KRaft, Docker) — 8-topic event log decoupling all pipeline stages

**Key structural decisions:** services/ layer is isolated from transport (no Kafka or HTTP dependencies in business logic — makes unit testing trivial); kafka/topics.py is single source of truth for topic names; rag/corpus/ contains mock service docs committed to repo with idempotent indexer at startup.

### Critical Pitfalls

1. **Hallucinated obligations reaching the legal gate** — Include a mandatory `source_quote` field in the Claude structured output schema; prompt Claude to extract quotes first, then derive obligations from quotes (not the reverse); legal gate UI must show source quotes side-by-side with AI summaries. Resolution: address in Phase 1 extraction schema design — retrofitting citation requirements after the fact is costly.

2. **PDF structure destruction** — Regulatory PDFs contain obligation matrices in tables that naive parsers convert to flat text; this propagates structurally degraded input through all downstream AI steps. Resolution: pymupdf4llm with explicit Markdown table conversion; pre-validate the demo document parses cleanly before building downstream stages.

3. **Human gates as checkbox theater** — Gate UIs with only Approve/Reject buttons (no evidence display) result in reviewers approving without reading, defeating the HITL thesis. Resolution: legal gate must show verbatim source quotes alongside AI summaries; engineering gate must show RAG retrieval evidence (which service doc chunks were retrieved and why). This is a UX architecture decision, not an afterthought.

4. **Structured output and Citations API cannot be combined** — Enabling both `output_config.format` and the Citations API in a single Claude request returns a 400 error. Resolution: commit to Pattern A (structured output with explicit `source_quote` fields in schema) — simpler integration, more reliable for downstream processing. Decide before building the extraction schema.

5. **Kafka complexity overwhelming prototype velocity** — Kafka is architecturally correct but introduces broker management, consumer group tracking, and silent failure modes. Resolution: single-node KRaft mode (no Zookeeper), minimal topic set, mandatory dead-letter queue and visible error states in UI, abstraction layer allowing fallback to in-process queue if Kafka fails on demo day.

6. **RAG chunking breaking retrieval precision** — Fixed 500-token chunks split service descriptions mid-sentence; 13% retrieval accuracy versus 87% for semantic boundary chunking. Resolution: one canonical chunk per service (name, integrations, data handled, regulatory domains), with sliding window overlap.

7. **Regulatory ambiguity misrepresented as AI certainty** — LLMs produce confident summaries for vague regulatory language ("adequate," "reasonable"). Resolution: include `ambiguity_flag` boolean and explanation in the extraction schema; highlight ambiguous obligations distinctly in legal gate UI.

## Implications for Roadmap

Based on combined research, the architecture's dependency graph dictates phase ordering. Data models and infrastructure must precede pipeline workers; the ingestion-to-legal-gate half-pipeline must be validated before building the RAG half; gate UIs must include evidence displays from their first build to avoid the checkbox theater pitfall.

### Phase 1: Foundation — Data Models, Infrastructure, and Kafka Backbone

**Rationale:** Everything downstream depends on the DB schema and Kafka topic topology. Define them wrong and every subsequent phase requires refactoring. The architecture research explicitly identifies this as the first dependency. Kafka setup in Docker Compose with health checks must also happen here — not after pipeline stages are built — to avoid silent consumer failures during Phase 2 development.

**Delivers:** PostgreSQL schema (documents, obligations, action_items, mappings, audit), Pydantic models, Kafka Docker Compose with KRaft (no Zookeeper), producer wrapper, base consumer class, topic constants file, dead-letter queue pattern, FastAPI project scaffold with CORS and lifespan events.

**Addresses features:** Pipeline state machine design, audit trail structure (build from day one — retrofitting is painful), document record schema.

**Avoids pitfalls:** Kafka silent failures (add health checks and DLQ before any worker depends on it); audit trail retrofit cost (add audit table now); schema drift from string-typed topic names (topics.py as single source of truth).

**Research flag:** Standard patterns — well-documented. No additional phase research needed.

### Phase 2: Document Ingestion and AI Obligation Extraction

**Rationale:** The pipeline entry point; all downstream stages consume what this phase produces. Claude structured output integration must be validated here (including the structured-output-vs-citations decision) before building consumers that depend on the schema. pymupdf4llm's AGPL license and extraction quality must also be validated against the demo document in this phase — switching parsers later is a mid-pipeline refactor.

**Delivers:** FastAPI `/documents/upload` endpoint, Ingestion Worker (pymupdf4llm PDF-to-Markdown), AI Engine Worker (Claude structured output obligation extraction with `source_quote` and `ambiguity_flag` fields), `ride.documents.parsed` and `ride.obligations.extracted` topics flowing end-to-end, obligations visible in DB.

**Addresses features:** Document ingestion (PDF), AI obligation extraction with citations, transparent reasoning display (ai_reasoning field in schema), ambiguity flagging.

**Avoids pitfalls:** Hallucinated obligations (source_quote in schema from day one); PDF structure destruction (pymupdf4llm with table validation); structured output + citations conflict (commit to Pattern A here); synchronous Claude calls blocking FastAPI (Claude only in workers).

**Research flag:** Needs phase research — Claude structured output schema design and prompt engineering for quote-first extraction are implementation-sensitive. Validate schema in Claude Workbench before coding the worker.

### Phase 3: RAG Corpus and System Mapper

**Rationale:** The RAG corpus must be built and retrieval quality validated before wiring the RAG worker into Kafka — the ARCHITECTURE.md build order makes this explicit. Chunking strategy is much harder to fix retroactively than to design correctly (13% vs 87% retrieval accuracy difference). Build and test retrieval in isolation, then connect to Kafka.

**Delivers:** Mock Wealthsimple service corpus (KYC Service, Trading Engine, Tax Reporting, Compliance Reporting, Auth Service, Notification Service — as Markdown files committed to repo), Qdrant Docker service with persistent volume, idempotent corpus indexer running at startup, LlamaIndex VectorStoreIndex, RAG query logic with top-k retrieval and Claude synthesis, retrieval precision validation (target >80% on test obligation queries), RAG Worker wired to Kafka.

**Addresses features:** RAG-based internal system mapping, mock service landscape as RAG corpus, multi-system mapping per obligation.

**Avoids pitfalls:** RAG chunking breaking retrieval (semantic boundary chunking, one canonical chunk per service); Chroma/vector DB not persisting between restarts (persistent volume from Phase 1); embeddings re-computed on every query (pre-embed corpus at startup, check for existing index).

**Research flag:** Needs phase research — semantic chunking strategy for technical service documentation and optimal top-k tuning are domain-specific. Research chunking approaches for API/service documentation specifically.

### Phase 4: Legal Gate and Action Item Generation

**Rationale:** The first human-in-the-loop gate unlocks the second half of the pipeline. Must be built with evidence display (source quotes) from the start — this is the pitfall research's strongest warning. Action Worker (obligation-to-action-item) depends on legal-approved obligations from this gate.

**Delivers:** FastAPI `/reviews/{obligationId}/approve` and `/reject` endpoints with audit log writes in same transaction, Action Worker (Claude obligation-to-action-item transformation with owner and deadline fields), Legal Review Gate UI (obligation list sorted by priority, source quote display, ambiguity flagging, approve/reject/comment form), audit trail table populated, `ride.obligations.approved` and `ride.actions.generated` topics flowing.

**Addresses features:** Legal review gate with approve/reject/priority, obligation-to-action-item transformation, audit trail, transparent reasoning display (source quotes in UI), priority/severity classification.

**Avoids pitfalls:** Human gate as checkbox theater (source quotes mandatory in UI — block phase completion if absent); audit trail as afterthought (write audit records in same DB transaction as state update); synchronous LLM freezing UI (Action Worker is async; legal gate UI shows stage-by-stage progress during processing).

**Research flag:** Standard patterns — REST gate endpoints and Pydantic-validated audit writes are well-documented. No phase research needed.

### Phase 5: Engineering Gate and Impact Analysis View

**Rationale:** The second HITL gate and the terminal output of the pipeline. RAG Worker is the most complex worker — the ARCHITECTURE.md build order recommends building the engineering gate UI first with hardcoded mock suggestions, then wiring the live RAG Worker. This allows gate UX validation before RAG integration complexity is added.

**Delivers:** RAG Worker wired end-to-end (action items → Qdrant search → Claude synthesis → draft mapping to DB), FastAPI `/mappings/{actionId}/confirm` and `/correct` endpoints with structured override form (replacement service + reason logged), Engineering Review Gate UI (draft mappings with RAG retrieval evidence per suggestion, confirm/override/reassign controls), final Impact Analysis view (systems-x-obligations matrix reflecting confirmed mappings including overrides), `ride.mappings.suggested` and `ride.mappings.confirmed` topics flowing, document state transitions to COMPLETE.

**Addresses features:** Engineering review gate with confirm/correct/reassign, systems-x-obligations impact matrix, multi-system mapping per obligation, engineering-side impact confirmation (novel vs. all competitors), RAG evidence display.

**Avoids pitfalls:** Engineering gate as checkbox theater (RAG retrieval evidence — which service doc chunks — shown per suggestion); final matrix reflecting overrides (not just AI's initial suggestions); incomplete RAG suggestions (top-k tuning validated in Phase 3 before wiring here).

**Research flag:** Needs phase research — the RAG synthesis prompt for multi-system mapping with confidence scoring is implementation-sensitive and domain-specific. Engineering gate UX for displaying retrieval evidence alongside service suggestions has sparse prior art.

### Phase 6: Pipeline Status, Polish, and Demo Preparation

**Rationale:** The demo deliverable. Pipeline status view, SSE upgrade from polling (optional), audit trail UI, and demo document curation. The architecture is complete after Phase 5; this phase makes it demo-ready and validates the full end-to-end flow.

**Delivers:** Pipeline progress indicator (stage-by-stage status display during processing), optional SSE upgrade from 2-second polling (FastAPI EventSourceResponse consuming `ride.pipeline.status`), audit trail read-only UI, architecture diagrams, demo document curation and happy-path validation (every obligation has verified source quote, at least one obligation flagged as ambiguous, RAG suggestions validated against known correct mappings), demo script and recording.

**Addresses features:** Pipeline status view, transparent reasoning display (step-by-step pipeline as inspectable stages — differentiator vs. Harvey's single-citation approach), audit trail visibility.

**Avoids pitfalls:** Demo document with hallucinated obligations (pre-validate full extraction before recording); demo pipeline too slow for live presentation (optionally pre-process demo document and start from AWAITING_LEGAL state); legal gate UI without source quotes (validate against "Looks Done But Isn't" checklist from PITFALLS.md).

**Research flag:** Standard patterns — SSE with FastAPI and EventSource in Next.js are well-documented. No phase research needed.

### Phase Ordering Rationale

The ordering is driven by three constraints from research:

- **Hard dependency chain:** DB schema → Kafka → ingestion worker → Claude extraction → legal gate → action worker → RAG mapper → engineering gate → impact matrix. No phase can meaningfully start without its predecessor's outputs.
- **Pitfall prevention front-loading:** The most consequential pitfalls (hallucinations, checkbox theater, structured output API constraint) must be addressed in their respective foundational phases — Phase 1-3. The pitfalls research explicitly warns that retrofitting citation requirements, chunking strategy, and audit trail is significantly more costly than getting them right initially.
- **Isolated validation:** RAG corpus and retrieval quality (Phase 3) is validated independently before being wired to Kafka and consumed by the engineering gate (Phase 5). This follows the build order from ARCHITECTURE.md and avoids debugging RAG quality and Kafka integration simultaneously.

### Research Flags

**Needs deeper research during planning:**
- Phase 2 (Obligation Extraction): Claude structured output schema design and quote-first extraction prompting. Validate schema and prompts in Claude Workbench against the actual demo regulatory document before writing production code.
- Phase 3 (RAG Corpus): Semantic chunking strategy for API/service documentation. Research chunking approaches specifically for technical service descriptions rather than general text.
- Phase 5 (Engineering Gate): RAG synthesis prompt for multi-system confidence-scored output. Engineering gate UX for displaying retrieval evidence has limited prior art — requires design iteration.

**Standard patterns (skip additional research):**
- Phase 1 (Foundation): PostgreSQL + SQLAlchemy async + Kafka Docker Compose are extensively documented.
- Phase 4 (Legal Gate): REST gate endpoints with Pydantic audit writes are standard FastAPI patterns.
- Phase 6 (Polish): SSE with FastAPI EventSourceResponse and Next.js EventSource are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices verified against official docs and release notes (PyPI, Anthropic docs, Next.js blog). Minor uncertainty on embedding model selection (sentence-transformers vs. Cohere). Version numbers current as of 2026-03-02. |
| Features | MEDIUM | Market analysis from multiple sources including official competitor materials. No internal user data — feature prioritization based on industry research and regulatory guidance, not user interviews. FINRA 2026 AI governance requirement verified via single secondary source. |
| Architecture | MEDIUM | Event-driven patterns and FastAPI/Kafka integration are well-documented. Kafka-to-SSE bridge pattern and confluent-kafka asyncio integration verified. Claude Structured Outputs beta status (pinned to SDK version) introduces some uncertainty on API stability. |
| Pitfalls | MEDIUM-HIGH | Legal AI hallucination statistics from peer-reviewed Stanford/Oxford sources (HIGH confidence). RAG chunking accuracy figures from applied-ai.com benchmark (MEDIUM). Regulatory ambiguity prevalence (23.4%) from academic source (MEDIUM). Kafka complexity trade-off analysis is community consensus. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Embedding model selection:** sentence-transformers (all-mpnet-base-v2, 768-dim, free) vs. Cohere embed-v4 (leading MTEB at 65.2, API cost). For a prototype with a small mock corpus, sentence-transformers is sufficient — validate retrieval precision in Phase 3 and switch to Cohere only if semantic quality is inadequate.
- **pymupdf4llm AGPL licensing:** Acceptable for a closed-source portfolio prototype. Flag explicitly in architecture docs — any externally deployed production version requires Artifex commercial license or migration to pdfplumber + pypdf (accepting lower Markdown quality).
- **Demo regulatory document selection:** Research recommends using a real regulatory document (e.g., FINTRAC PCMLTFA guidance) to validate the happy path is verifiable. This must be confirmed before Phase 2 begins — the demo document choice affects schema design, prompt engineering, and gate UX validation.
- **Kafka-to-SSE bridge at prototype scale:** The SSE bridge pattern (FastAPI consuming `ride.pipeline.status`, Next.js EventSource) is MEDIUM confidence — one primary source. Validate the bridge works with confluent-kafka's synchronous consumer poll inside an asyncio context before building the full pipeline status view.

## Sources

### Primary (HIGH confidence)
- [Anthropic Claude Structured Outputs — Official Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — structured output schema, ZDR policy, model support
- [PyPI: anthropic 0.84.0](https://github.com/anthropics/anthropic-sdk-python/releases) — SDK version confirmed Feb 25, 2026
- [PyPI: pymupdf4llm 0.3.4](https://pypi.org/project/pymupdf4llm/) — version confirmed Feb 14, 2026
- [PyPI: confluent-kafka 2.13.0](https://pypi.org/project/confluent-kafka/) — version confirmed Jan 5, 2026
- [PyPI: qdrant-client 1.17.0](https://pypi.org/project/qdrant-client/) — version confirmed Feb 19, 2026
- [PyPI: llama-index 0.14.15](https://pypi.org/project/llama-index/) — version confirmed Feb 18, 2026
- [Legal RAG Hallucinations — Stanford/Journal of Empirical Legal Studies 2025](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) — peer-reviewed; 17-33% hallucination rate in legal RAG tools
- [Large Legal Fictions — Oxford Journal of Legal Analysis](https://academic.oup.com/jla/article/16/1/64/7699227) — peer-reviewed; 69-88% hallucination rate in ungrounded LLM legal contexts
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — official install instructions
- [Next.js 15 release blog](https://nextjs.org/blog/next-15) — App Router, version status
- [Kafka Exactly-Once Semantics — Confluent Official](https://docs.confluent.io/kafka/design/delivery-semantics.html) — delivery guarantees

### Secondary (MEDIUM confidence)
- [Harvey AI design principles](https://www.harvey.ai/blog/how-we-approach-design-at-harvey) — chain-of-thought visibility, citation trust model
- [Ascent RegTech RLM Platform](https://www.ascentregtech.com/rlm-platform/) — competitor feature analysis
- [Thomson Reuters CoCounsel 1M users](https://www.prnewswire.com/news-releases/one-million-professionals-turn-to-cocounsel-as-thomson-reuters-scales-ai-for-regulated-industries-302694903.html) — competitor scale reference
- [PDF Parsing Benchmark — Applied AI](https://www.applied-ai.com/briefings/pdf-parsing-benchmark/) — 75% text accuracy vs 13% structure preservation in naive parsers
- [Best Chunking Strategies for RAG 2025 — Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag) — 13% fixed vs 87% semantic boundary accuracy
- [LangChain vs LlamaIndex 2025 — Latenode](https://latenode.com/blog/langchain-vs-llamaindex-2025-complete-rag-framework-comparison) — 40% faster retrieval for LlamaIndex (single source)
- [Human-in-the-loop financial services requirement](https://fintech.global/2026/01/08/ai-regulatory-compliance-priorities-financial-institutions-face-in-2026/) — multiple industry sources corroborate
- [FINRA 2026 AI governance — Fintech Global](https://fintech.global/2025/12/31/why-finras-2026-report-puts-ai-governance-under-scrutiny/) — AI governance scrutiny, single secondary source
- [Regulatory Requirement Ambiguity — GJETA 2025](https://gjeta.com/sites/default/files/GJETA-2025-0187.pdf) — 23.4% of requirements require human judgment, academic source
- [Kafka Python AsyncIO Integration — Confluent Blog](https://www.confluent.io/blog/kafka-python-asyncio-integration/) — asyncio integration pattern

### Tertiary (LOW confidence)
- [LangChain vs. LlamaIndex retrieval benchmark](https://latenode.com/blog/langchain-vs-llamaindex-2025-complete-rag-framework-comparison) — 40% claim needs validation; single source
- [Kafka complexity trade-off](https://medium.com/@techInFocus/kafka-is-it-time-to-admit-its-overkill-for-most-apps-131cd8a7dbbd) — opinion piece; consistent with ecosystem consensus but not authoritative
- [AI obligation extraction time savings (5.3 hrs/obligation manual baseline)](https://auditboard.com/blog/how-ai-helps-solve-the-4-biggest-challenges-in-regulatory-compliance) — vendor-published, no primary source cited; use only for framing, not as evidence

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
