# Pitfalls Research

**Domain:** Regulatory AI compliance pipeline — LLM document processing, RAG system mapping, async workflow with human-in-the-loop gates
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH (web research verified across multiple sources; Claude API specifics verified against official docs)

---

## Critical Pitfalls

### Pitfall 1: Treating Hallucinated Obligations as Ground Truth

**What goes wrong:**
The Claude API extracts regulatory obligations from a dense PDF. The summary looks plausible — correct-sounding section references, professional language, coherent structure. The legal reviewer approves it. Weeks later, someone reads the actual regulation and discovers the AI invented two obligations that don't exist, and missed a third that does. Legal RAG tools from LexisNexis and Thomson Reuters hallucinate 17-33% of the time on verified legal questions despite "hallucination-free" marketing. General LLMs hallucinate legal content at rates of 69-88% in ungrounded contexts.

**Why it happens:**
LLMs are trained to sound authoritative. When parsing dense regulatory language, they fill ambiguous or truncated sections with plausible-sounding completions that match regulatory writing patterns. PDF parsing failures compound this — if a table is converted to unstructured text, numeric thresholds get garbled, and the LLM hallucinates plausible replacement numbers.

**How to avoid:**
- Use Claude's citation API to require every extracted obligation to reference a verbatim quote from the source document. Obligations without a supporting quote should be flagged, not displayed.
- Prompt Claude to extract quotes first, then derive obligations from those quotes — not the reverse.
- The legal gate UI must display source quotes alongside AI summaries, not just summaries. Reviewers need to verify the extraction against the original.
- For the demo: use a real regulatory document (e.g., FINTRAC PCMLTFA guidance) so the happy path is verifiable.
- Note: Claude's structured output and citation features cannot be combined in the same request — choose one, or use tool calls with citations as explicit fields in the schema.

**Warning signs:**
- AI summaries that are more specific than the source document allows
- Obligations referencing section numbers not present in the uploaded document
- Numeric thresholds in extracted items that differ from source text
- Legal reviewer approving without scrolling to verify source section

**Phase to address:**
Document ingestion and parsing phase (Phase 1-2). The citation requirement and quote-first prompt strategy must be baked in from the start, not retrofitted.

---

### Pitfall 2: PDF Structure Destruction in Document Ingestion

**What goes wrong:**
A regulatory PDF is uploaded. It contains tables listing obligations by section, numbered cross-references, and definitions embedded in footnotes. The PDF parser converts all of this to a flat stream of text. Tables become comma-separated runs of words. Section numbering gets merged into surrounding paragraphs. The LLM receives structurally degraded input and produces structurally degraded output — wrong section attribution, missed tabular obligations, scrambled numeric thresholds.

Research from 2025 shows parsers can achieve 75% text accuracy while recovering only 13% of structure. GPT-4o-mini exhibited this exact failure mode — acceptable text scores with catastrophic structure preservation.

**Why it happens:**
Naive PDF-to-text conversion (PyPDF2, pdfplumber without configuration) treats the document as a flat character stream. Regulatory documents are highly structured: they use tables for obligation matrices, numbered hierarchies for cross-referencing, and footnotes for definitions. Plain text extraction destroys these relationships.

**How to avoid:**
- Use a parser designed for structure-preserving extraction. Docling (IBM, open source) and LlamaParse (commercial API) lead the 2025 benchmark for regulatory-style documents.
- Convert tables to Markdown format explicitly — this preserves row/column relationships in an LLM-native format and significantly reduces numeric hallucinations.
- For the demo, pre-validate that the chosen regulatory document parses cleanly. Pick a document with clean digital text (not a scanned image) for the happy path.
- Pass section headers and numbering as structured metadata alongside chunk text so the LLM can attribute obligations correctly.

**Warning signs:**
- Extracted text shows merged columns ("Section 5.2.1 Threshold $50,000 Reporting" compressed to "Section 5.2.1Threshold$50000Reporting")
- LLM obligation summaries omit anything that was in tables
- Footnote definitions not appearing in any extracted chunks
- Confidence scores from parser (LlamaParse provides these) flagging pages below 0.7

**Phase to address:**
Phase 1 (document ingestion). This is a pipeline foundation issue — the wrong parser choice propagates downstream through all subsequent AI steps.

---

### Pitfall 3: RAG Chunking Strategy That Breaks Regulatory Cross-References

**What goes wrong:**
The RAG corpus of mock internal service documentation is chunked at fixed 500-token boundaries. A service description is split mid-sentence between chunks. When a regulatory obligation triggers a RAG query like "which system handles KYC identity verification?", the relevant chunk contains only half the relevant context, the embedding is weak, and the wrong service is retrieved — or nothing is retrieved at all.

Research shows that for legal documents, fixed-size chunking achieves ~13% accuracy versus 87% for adaptive chunking aligned to logical topic boundaries.

**Why it happens:**
Token-count-based chunking is the default in most RAG tutorials and library examples. It's easy to implement and works acceptably for short, self-contained documents like FAQ pages. Regulatory and technical documentation has different structure — sections, subsections, definitions that reference each other across pages. Splitting at arbitrary byte boundaries destroys these relationships.

**How to avoid:**
- Chunk the internal documentation corpus by semantic boundaries: one chunk per service description, one chunk per API specification section, one chunk per architecture component. If a section is too long, split at sub-section boundaries, not at character counts.
- Use sliding window overlap (10-15% of chunk size) so cross-boundary context is preserved.
- For each mock Wealthsimple service, create one canonical chunk that includes: service name, systems it integrates with, data it handles, and regulatory domains it touches. This chunk is the retrieval target.
- Start retrieval at top-k=5, evaluate precision, then tune. Don't assume defaults are correct.

**Warning signs:**
- RAG suggestions are plausible but wrong (e.g., suggests Tax Reporting for a KYC obligation — related domain but wrong service)
- Retrieved context passages are syntactically incomplete (end mid-sentence or start mid-thought)
- Engineering reviewers at Gate 2 consistently overriding all AI suggestions
- Embedding similarity scores below 0.6 for queries that should clearly match

**Phase to address:**
RAG corpus construction phase (before the system mapper is tested). Chunking strategy is far harder to fix retroactively than to design correctly up front.

---

### Pitfall 4: Human Review Gates That Are Checkbox Theater

**What goes wrong:**
The legal gate is built. The UI shows the AI summary and two buttons: Approve and Reject. The reviewer clicks Approve without reading the source citations because the summary looks reasonable and there's no friction requiring engagement. The engineering gate has the same problem — engineers confirm whatever RAG suggests because the interface doesn't surface enough context to evaluate it. The human-in-the-loop exists in the architecture diagram but not in the actual workflow.

This is the #1 anti-pattern identified in 2025 research on HITL systems in regulated industries. Gates exist but don't function as actual review steps.

**Why it happens:**
Building approval buttons is trivial. Building an interface that makes reviewers meaningfully engage with the underlying evidence requires UX investment. Teams prioritize getting the pipeline functional over making the gate meaningful. The demo consequence: the prototype claims to have human oversight but doesn't demonstrate it.

**How to avoid:**
- Gate 1 (Legal): Display the AI summary with each obligation linked to its source quote in the document. The interface should show both, side by side. Reviewers must see what the AI read, not just what it concluded.
- Gate 1: Include a confidence indicator per obligation that shows when the AI found ambiguous language (this is a demo differentiator, not just a checkbox).
- Gate 2 (Engineering): Show the AI's retrieval reasoning — why did RAG suggest this service? What documentation did it retrieve? Engineers need context to meaningfully confirm or override.
- Gate 2: Provide a structured override form: "Replace with [service] because [free text reason]" — not just a correction but a logged correction.
- For the demo video: show the reviewer actually using the context, not just clicking approve.

**Warning signs:**
- Gate UI has approve/reject buttons but no source document view
- No way to see what evidence the AI used to reach a suggestion
- No reason-capture on overrides
- The demo script shows a human clicking approve without showing them reading anything

**Phase to address:**
Gate UI design phase. This is a UX architecture decision — it must be in scope for the phase that builds the review screens, not added afterward.

---

### Pitfall 5: Kafka Complexity Overwhelming a Prototype

**What goes wrong:**
Kafka is chosen for async messaging because it demonstrates production-grade architecture. But Kafka requires: a broker running locally, topic configuration, consumer group management, offset tracking, and retry logic. During development, a Kafka broker crash silently halts the pipeline with no visible error. During the demo, the consumer is lagging and the document appears "stuck." The developer spends two days debugging Kafka configuration instead of building the AI pipeline.

Kafka is acknowledged as massively over-engineered for most applications — "what starts as simple pub/sub becomes a tangled web of topics, consumer groups, retry logic, schema evolution, and backpressure tuning."

**Why it happens:**
Kafka is architecturally correct for a production regulatory pipeline at scale. For a single-user, single-document prototype, it introduces infrastructure overhead with no corresponding benefit. The demo doesn't validate throughput or durability — it validates the pipeline logic.

**How to avoid:**
- Run Kafka via Docker Compose so local setup is deterministic and reproducible. Use a single-node KRaft mode (no Zookeeper) to reduce operational surface area.
- Define exactly two topics: `documents.ingested` and `obligations.approved`. Keep the topology simple.
- Add explicit dead letter queues and visible error states so if Kafka has an issue, it surfaces in the UI rather than silently stopping.
- Accept that the architecture diagram correctly shows Kafka's role even if the demo runs locally on minimal infrastructure. The diagram communicates systems thinking; the demo validates the pipeline logic.
- Alternative hedge: build the pipeline to work with both Kafka and a simple in-process queue via an abstraction layer — if Kafka causes demo-day issues, you can switch without rewriting business logic.

**Warning signs:**
- "Consumer is not receiving messages" with no visible error
- Pipeline appears stuck at a stage with no timeout or error UI
- More time spent on Kafka configuration than on AI pipeline logic
- No health check endpoint for Kafka consumer lag

**Phase to address:**
Infrastructure setup phase. Design the Kafka integration with minimal topics from the start; the temptation to add more topics as the pipeline grows is a scope creep risk.

---

### Pitfall 6: Structured Outputs and Citations Cannot Be Combined in Claude API

**What goes wrong:**
The pipeline is designed to return a structured JSON payload containing extracted obligations AND citation blocks pointing to source text. During implementation, the developer discovers that Claude's `output_config.format` (structured JSON output) and the Citations API feature conflict — enabling both returns a 400 error. The feature that seemed most architecturally elegant (structured + cited) is not supported as a single API call.

**Why it happens:**
This is a documented API constraint in the Claude structured outputs implementation. The API's constrained decoding for structured output operates differently from the citation interleaving mechanism, and they cannot run simultaneously. This is easy to miss if designing from documentation summaries rather than the actual API reference.

**How to avoid:**
- Choose one of two patterns and commit:
  - Pattern A: Use structured output (`output_config.format`) and include quote fields in the schema explicitly: `{"obligation": "...", "source_quote": "...", "source_section": "..."}`. Claude populates these manually, not via the Citations API. Requires careful prompting to maintain citation accuracy.
  - Pattern B: Use free-text output with Citations API enabled, then parse the citation blocks in application code to build the structured representation. More reliable citations, more complex parsing.
- Pattern A is recommended for this prototype — simpler integration, structured output is more reliable for downstream processing, and explicit quote fields in the schema make the human gate UI easier to build.

**Warning signs:**
- `400 Bad Request` when enabling both `output_config.format` and `betas: ["citations-2024-05-xx"]`
- Citation blocks appearing in unexpected positions in structured output
- JSON parsing failures on Claude responses when citations are enabled

**Phase to address:**
Phase 1 (API integration). This must be discovered and decided before building the extraction schema — it affects the entire downstream data model.

---

### Pitfall 7: Regulatory Ambiguity Misrepresented as AI Certainty

**What goes wrong:**
A regulation says "firms must maintain adequate records." The AI extracts an obligation: "Maintain adequate records." No nuance, no flagging that "adequate" is undefined, no indication that this obligation requires legal judgment to interpret. The legal reviewer sees a clean extracted obligation and approves it without knowing the AI glossed over the definitional gap. The engineering team then tries to map this to a specific system action and can't, because the obligation is underspecified.

Research shows 23.4% of regulatory requirements contain ambiguities severe enough to require human judgment — LLMs systematically fail to flag these, instead producing confident-sounding summaries.

**Why it happens:**
LLMs are trained to produce coherent, confident output. Regulatory language is deliberately vague ("adequate," "reasonable," "appropriate") because it's intended to be interpreted case-by-case. AI pipelines that don't account for this produce false precision — appearing to have resolved something that requires expert judgment.

**How to avoid:**
- Include an explicit `ambiguity_flag` field in the structured output schema: a boolean plus a free-text explanation of what's ambiguous.
- Prompt Claude to flag any obligation containing vague qualifiers ("adequate," "appropriate," "reasonable," "timely") and explain why interpretation is required.
- In the legal gate UI, highlight ambiguous obligations with a distinct visual treatment — not just yellow, but an explanation of what needs legal clarification before engineering action can proceed.
- For the demo: show one obligation that is flagged as ambiguous. This demonstrates the system's honesty about AI limitations — a differentiator over systems that always appear confident.

**Warning signs:**
- All extracted obligations appear equally certain
- No obligations are flagged for legal clarification
- Obligations containing "adequate," "appropriate," or "reasonable" with no uncertainty marker
- Legal reviewers approving obligations without any clarifying notes

**Phase to address:**
Phase 1-2 (extraction schema design and legal gate UI). The `ambiguity_flag` field must be in the schema from the beginning; the legal gate UI must be designed to surface it.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Prompt-based JSON parsing instead of structured outputs | Faster initial setup | Unreliable output format, parsing failures, silent data loss | Never — use structured outputs from day one |
| In-memory vector store (no persistence) | Zero setup time | RAG corpus lost on restart, demo requires re-ingestion each run | Only in early dev; must persist before any demo |
| Hardcoded regulatory document in demo | Guarantees happy path | Not generalizable, reviewer knows the "right answers" | Acceptable for the portfolio demo |
| Single Kafka consumer with no dead letter queue | Simple setup | Silent pipeline failures, no way to diagnose stuck documents | Unacceptable — always add error visibility |
| Skipping source-quote verification in extraction | Faster extraction | Hallucinations reach the legal gate unchallenged | Never for compliance domain |
| Fixed 500-token chunk size for RAG corpus | Default behavior, no tuning | Wrong service suggestions, poor retrieval precision | Never for structured technical documentation |
| Synchronous Claude API calls for document processing | Simple code | UI appears frozen during processing, Vercel/serverless timeouts | Never — use streaming or async task pattern |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Combining `output_config.format` with Citations API in one request | Choose one: structured output with explicit quote fields in schema, or free-text with citations; not both |
| Claude API | Sending full 50-page PDF as base64 in every extraction call | Chunk document, process chunks, cache results; avoid re-sending the full document on retries |
| Claude API | Using `max_tokens` too low for structured output with many fields | Regulatory documents produce large outputs; set `max_tokens` to 4096+ for extraction calls |
| Kafka + Python | Consumer using default auto-commit offset | Disable auto-commit; commit only after successful processing and database write |
| Kafka local dev | Running Kafka without health checks in Docker Compose | Add `healthcheck` to Kafka service; make app container depend_on with condition: service_healthy |
| Vector DB | Not persisting embeddings between server restarts | Use persistent storage (Chroma with a volume mount, or Qdrant with persistence enabled) from day one |
| Next.js + FastAPI | Long-running Claude calls timing out via Vercel proxy | Use FastAPI background tasks + polling endpoint, or Server-Sent Events for streaming; don't make synchronous calls through serverless functions |
| PDF upload | Accepting any PDF without size/type validation | Validate file type (magic bytes, not just extension), enforce 20MB limit, reject password-protected PDFs early |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full document re-embedding on every RAG query | RAG queries take 5+ seconds; demo feels sluggish | Pre-embed corpus on startup, persist to disk, only re-embed on corpus changes | Immediately — even with 10 mock documents |
| Synchronous Claude API call in HTTP request handler | Browser shows "loading" for 30-60 seconds; serverless timeout | Use background task pattern: submit → poll / SSE stream | First document > 10 pages |
| Fetching all Kafka messages in a tight loop | CPU spikes, consumer lag grows | Use proper consumer poll intervals, set max.poll.records | Not applicable at demo scale but causes local dev heat |
| Storing full PDF binary in Kafka message | Message size limit exceeded (default 1MB) | Store PDF to filesystem/S3, put only reference (filename, path) in Kafka message | Any PDF > 1MB |
| Computing embeddings on every request instead of caching | RAG initialization takes 30+ seconds after restart | Persist ChromaDB/Qdrant to a volume; warm on startup | On every server restart during demo |

---

## Security Mistakes

Domain-specific security issues beyond general web security. (Note: this is a prototype — production hardening is out of scope, but these matter for demo credibility.)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Hardcoding Claude API key in Next.js frontend | API key exposed in browser source | Always server-side only; use Next.js API routes or FastAPI as proxy |
| Logging full document content to console/files | Sensitive regulatory text in unprotected logs | Log only metadata (doc ID, page count, processing stage); never log content |
| No input validation on uploaded PDFs | Malicious PDF triggers parser crashes or prompt injection | Validate file type by magic bytes, enforce size limits, sanitize filename |
| Prompt injection via document content | Adversarial regulatory document manipulates Claude's behavior | Wrap document content in explicit XML tags; instruct Claude to treat content as data, not instructions |
| Exposing raw Kafka/vector DB on host network | Broker accessible from outside Docker network | Keep all infrastructure on internal Docker network; only expose Next.js and FastAPI |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw JSON output from Claude in the UI | Reviewer loses trust immediately; prototype looks unfinished | Always render structured data as formatted cards, never expose raw API response |
| Single spinner during 30-second Claude call | User doesn't know if pipeline is working or broken | Show stage-by-stage progress: "Parsing PDF... Extracting obligations... Mapping to systems..." |
| Approve/Reject buttons without source context | Reviewer can't meaningfully validate; human gate is theater | Show AI summary side-by-side with verbatim source quotes from the document |
| Displaying all confidence levels as high | Reviewer misses genuinely ambiguous obligations | Use a three-tier confidence display (high/medium/ambiguous-requires-review) with distinct visual treatment |
| Engineering gate showing only service names | Engineer can't evaluate why RAG suggested a service | Show the retrieved documentation snippet that supports each suggestion |
| No success state after final approval | Pipeline completion is invisible; demo feels inconclusive | Show an impact matrix (systems x obligations) as the final output — this is the deliverable |
| Cluttered obligation list without priority | Legal reviewer can't triage; everything feels equal urgency | Sort by AI-assigned priority (High/Medium/Low) with override capability at the gate |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Document upload:** Appears to work but may fail silently on multi-page PDFs — verify parsing output page count matches document page count
- [ ] **Obligation extraction:** Returns JSON but may omit obligations from tables or footnotes — manually verify against source for every demo document
- [ ] **Source citations:** Each obligation shows a quote field — verify quotes are verbatim extracts, not paraphrases (paraphrases are hallucinations)
- [ ] **RAG system mapping:** Returns service names — verify each suggestion has a retrieved documentation snippet and not just a name
- [ ] **Ambiguity flagging:** AI flags some obligations as ambiguous — verify it flags the genuinely ambiguous ones, not just flags randomly
- [ ] **Legal gate override:** Reject works in UI — verify rejected obligations don't proceed to the RAG stage and are logged
- [ ] **Engineering gate override:** Override form saves — verify the correction is recorded and appears in the final impact matrix
- [ ] **Kafka pipeline:** Messages flow in dev — verify the pipeline recovers gracefully if the consumer is restarted mid-flow
- [ ] **Final impact matrix:** Displays systems x obligations — verify it correctly reflects any gate overrides, not just the original AI suggestions
- [ ] **Demo video path:** The happy path appears smooth — walk through the full demo three times before recording; failure on take one wastes time

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Discovered hallucinated obligation mid-demo | HIGH (destroys prototype credibility) | Curate demo document in advance to a known-good regulatory text; pre-validate all extractions before recording |
| PDF parser destroying table structure | MEDIUM | Switch parsers (Docling → LlamaParse or vice versa); re-run on the demo document; verify output |
| RAG returning wrong services consistently | MEDIUM | Re-chunk corpus at semantic boundaries; re-embed; re-run retrieval evaluation; top-k tuning |
| Kafka consumer stuck / silent failure | MEDIUM | Add explicit dead letter queue and health status endpoint immediately; restart with clean consumer group |
| Claude API structured output schema mismatch | LOW | Iterate on schema in isolation; use Claude Workbench to test prompts before integrating |
| Legal gate UI ships without source quotes | HIGH (human gate is theater without it) | Block phase completion; source quotes are non-negotiable for demo credibility |
| Demo pipeline too slow for live demo | MEDIUM | Pre-process the demo document; start the demo from a pre-processed state if live processing is too slow |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hallucinated obligations reach legal gate | Phase 1: Document parsing + extraction design | Every obligation has a non-empty source_quote field that is verbatim from the document |
| PDF structure destruction | Phase 1: Document ingestion | Parser output compared against source document; tables preserved as Markdown |
| RAG chunking breaks retrieval | Phase 2: RAG corpus construction | Retrieval precision > 80% on test queries; no returned chunks that are syntactically incomplete |
| Human gates are checkbox theater | Phase 3: Gate UI design | Legal gate UI shows source quotes; engineering gate shows RAG retrieval evidence |
| Kafka silently stalling pipeline | Phase 1-2: Infrastructure setup | Dead letter queue configured; error states visible in UI; health endpoint active |
| Structured output + citations conflict | Phase 1: API integration | Schema includes explicit quote fields; no use of Citations API alongside output_config.format |
| Ambiguity misrepresented as certainty | Phase 2: Extraction schema | ambiguity_flag field in schema; at least one demo obligation flagged as ambiguous |
| Synchronous LLM call freezing UI | Phase 2: API layer | No synchronous Claude calls in HTTP request handlers; progress states visible during processing |

---

## Sources

- [LLMs for Regulatory Compliance Document Processing — Rohan Paul](https://www.rohan-paul.com/p/llms-for-regulatory-compliance-document) — MEDIUM confidence
- [Legal RAG Hallucinations — Stanford / Journal of Empirical Legal Studies 2025](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) — HIGH confidence (peer-reviewed)
- [Large Legal Fictions: Profiling Legal Hallucinations in LLMs — Oxford Journal of Legal Analysis](https://academic.oup.com/jla/article/16/1/64/7699227) — HIGH confidence (peer-reviewed)
- [Claude Structured Outputs — Official Anthropic API Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — HIGH confidence (official)
- [Reduce Hallucinations — Claude API Docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations) — HIGH confidence (official)
- [PDF Parsing State of the Art: 800+ Documents, 7 Frontier LLMs — Applied AI](https://www.applied-ai.com/briefings/pdf-parsing-benchmark/) — MEDIUM confidence
- [Best Chunking Strategies for RAG 2025 — Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag) — MEDIUM confidence
- [RAG: Fundamentals, Challenges, and Advanced Techniques — Label Studio](https://labelstud.io/blog/rag-fundamentals-challenges-and-advanced-techniques/) — MEDIUM confidence
- [Human-in-the-Loop for AI Agents: Best Practices — Permit.io](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) — MEDIUM confidence
- [Regulatory Requirement Ambiguity Research — GJETA 2025](https://gjeta.com/sites/default/files/GJETA-2025-0187.pdf) — MEDIUM confidence (academic)
- [Kafka Exactly-Once Semantics — Confluent Official Documentation](https://docs.confluent.io/kafka/design/delivery-semantics.html) — HIGH confidence (official)
- [Kafka Is It Overkill for Most Apps — Medium / Tech In Focus](https://medium.com/@techInFocus/kafka-is-it-time-to-admit-its-overkill-for-most-apps-131cd8a7dbbd) — LOW confidence (opinion piece, but consistent with ecosystem consensus)
- [Next.js Timeout Solutions — Inngest Blog](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts) — MEDIUM confidence
- [LLM Hallucinations in Financial Institutions — BizTech Magazine 2025](https://biztechmagazine.com/article/2025/08/llm-hallucinations-what-are-implications-financial-institutions) — MEDIUM confidence
- [FINRA 2026 AI Governance Report — Fintech Global](https://fintech.global/2025/12/31/why-finras-2026-report-puts-ai-governance-under-scrutiny/) — MEDIUM confidence

---

*Pitfalls research for: RIDE — Regulatory Integrated Development Environment (AI compliance pipeline prototype)*
*Researched: 2026-03-02*
