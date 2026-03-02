# Feature Research

**Domain:** Regulatory AI compliance pipeline — fintech / legal AI
**Researched:** 2026-03-02
**Confidence:** MEDIUM (market analysis from multiple sources; no internal user data)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any credible regulatory AI tool must have. Missing these makes the product feel broken or untrustworthy to legal/compliance professionals.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document ingestion (PDF + URL) | Every RegTech tool ingests source documents; manual copy-paste is a non-starter | LOW | PDFs are the universal format for regulatory publications; URL ingestion (e.g., OSFI, FINTRAC pages) expected |
| AI-generated obligation extraction | Core value of all RegTech tools; transforms dense legalese into discrete, actionable obligations | MEDIUM | Harvey, Ascent, CoCounsel all extract obligations as atomic units — not summaries, but enumerated requirements |
| Inline citations and source references | Legal professionals will not trust output without traceable sources; Harvey's entire trust model rests on this | MEDIUM | Every obligation/summary must link back to the specific paragraph or section of the source document |
| Transparent AI reasoning ("show your work") | Harvey design principle: "backtrack through the logic the AI applied." Regulators and lawyers expect explainability | HIGH | Chain-of-thought visibility is now a regulatory expectation in financial services (FINRA 2026 report) |
| Human review / approval gate | Regulators explicitly require human sign-off on AI-generated compliance outputs in financial services. Non-negotiable | MEDIUM | Both legal gate and engineering gate are required by industry norms, not just design choice |
| Priority/severity classification | Compliance teams must triage — not all obligations are equal. Deadlines, enforcement risk differ | MEDIUM | Ascent uses priority flags; CoCounsel routes by urgency. Legal reviewer must be able to set/override |
| Obligation-to-action-item transformation | Gap between "what the regulation says" and "what we need to do internally" must be bridged explicitly | HIGH | Ascent calls these "obligation registers"; Thomson Reuters surfaces "structured work product" |
| Audit trail for all decisions | Regulators demand documentation of who reviewed what, when, and what decision was made | MEDIUM | Every approve/reject/reassign action must be timestamped and attributable. Cryptographic integrity optional for prototype |
| Document version tracking | Regulations are amended; teams need to see what changed between versions | MEDIUM | Ascent's "Rule Compare" does side-by-side redlined comparison. Table stakes for change management tools |
| Status/pipeline visibility | Legal and engineering teams need to see where each document is in the workflow at any point | LOW | Simple pipeline state machine: ingested → parsed → legal review → approved → mapped → engineering review → done |

### Differentiators (Competitive Advantage)

Features that existing tools lack or do partially. These are what make RIDE distinctive as a portfolio prototype and, conceptually, as a product.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| RAG-based internal system mapping | No existing RegTech tool maps regulatory obligations to the specific internal services/systems affected. Ascent maps to GRC controls, not engineering systems | HIGH | The engineering gate is novel: AI suggests which microservices/APIs are touched, engineers confirm/correct. This closes the gap between legal compliance and engineering action |
| Multi-system mapping per obligation | A single regulatory change (e.g., KYC update) touches multiple systems simultaneously (KYC Service, Trading Engine, Tax Reporting). Competitors show obligation registers, not system impact matrices | HIGH | The final "systems x obligations" matrix is a unique output that bridges legal and engineering organizations |
| Two explicit human-in-the-loop gates | Most tools have one review stage. RIDE's dual-gate model (legal approval + engineering confirmation) makes the AI's role honest and auditable at both layers | MEDIUM | Harvey has a single workflow; Ascent has compliance-side review only. Two gates reflect financial services regulatory expectations more accurately |
| Reasoning pipeline visibility (step-by-step) | Harvey shows citations; RIDE can go further by exposing each pipeline stage as an inspectable step (what the AI parsed, what it inferred, what it matched via RAG) | HIGH | Kafka event log as the backbone makes each stage observable — differentiator for demo: show the pipeline as it runs |
| Engineering-side impact confirmation | No existing tool in the market has engineering confirmation of system impact as a first-class workflow step. This is novel for a compliance tool | MEDIUM | Engineers see: regulation text summary + suggested systems + RAG evidence. They confirm/correct/add systems |
| Mock service landscape as RAG corpus | Wealthsimple-like service documentation (KYC, Trading Engine, Tax Reporting, etc.) as a realistic, domain-specific retrieval corpus | LOW | Demo-specific but conceptually demonstrates how any org could load their own service docs into the RAG store |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but would undermine the prototype's core thesis or create scope explosion.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous obligation approval | Speed — why have humans review every item? | Financial regulators explicitly require human sign-off on AI compliance outputs (FINRA 2026). Removing the gate makes the product legally inadvisable and contradicts the prototype's design thesis | Keep the legal gate mandatory; AI can pre-score confidence and flag low-risk items for faster review, but never auto-approve |
| Real-time regulatory feed monitoring | Proactive compliance — know about new rules as they publish | Out of scope for prototype; requires regulatory data vendor relationships (Bloomberg Law, Westlaw feeds, OSFI RSS), auth, and ongoing data maintenance | Manual document ingestion for demo; note in architecture that a production version would plug in regulatory data providers |
| Code generation or PR creation | Engineering wants to close the loop — go from impact to fix automatically | Unreliable, dangerous (AI-generated changes to financial systems without senior review), and out of scope. Stops the prototype at the right boundary | The engineering gate produces a confirmed impact list; actual implementation is a separate, human-driven process |
| Multi-tenancy and user authentication | Enterprise readiness | Significant scope increase for what is a polished prototype. Adds auth provider, tenant isolation, RBAC, session management | Single-user demo with clearly documented architecture for how multi-tenancy would be added in production |
| Mobile responsiveness | Modern products should be mobile-first | Compliance and legal work is desktop-dominated; the dense information density of the UI (systems matrix, obligation lists, citations) does not translate to mobile | Desktop-first; document the decision explicitly |
| Automated obligation compliance scoring | "Tell me if we're already compliant" | Requires understanding of current internal control state — impossible without real codebase/policy integration. False confidence is dangerous in financial compliance | Show what needs to be done, not whether it's already done. Engineering gate confirms affected systems, not current compliance status |
| Real-time collaboration (multi-user editing) | Teams work together on reviews | Adds significant websocket infrastructure complexity. Legal review is typically sequential (one person approves before next step) | Sequential workflow is correct for compliance — ensures clear accountability. Note multi-user collaboration as a v2 consideration |
| Regulatory feed aggregation (50+ sources) | Comprehensive coverage | Scope explosion; API management, normalization, quality control across sources | One well-chosen source document per demo flow. Architecture diagram shows where feed aggregation would plug in |

---

## Feature Dependencies

```
[Document Ingestion]
    └──requires──> [AI Parsing + Obligation Extraction]
                       └──requires──> [Citation/Source Linking]
                       └──requires──> [Legal Review Gate]
                                          └──requires──> [Priority Classification]
                                          └──requires──> [Approve/Reject + Audit Trail]
                                                             └──requires──> [Obligation-to-Action-Item Transform]
                                                                                └──requires──> [RAG System Mapper]
                                                                                                   └──requires──> [Mock Service Corpus]
                                                                                                   └──requires──> [Engineering Review Gate]
                                                                                                                      └──requires──> [Confirm/Correct/Reassign UI]
                                                                                                                      └──requires──> [Systems x Obligations Matrix]

[Transparent Reasoning Display] ──enhances──> [AI Parsing + Obligation Extraction]
[Transparent Reasoning Display] ──enhances──> [RAG System Mapper]

[Pipeline Status View] ──enhances──> [All stages]

[Audit Trail] ──requires──> [Legal Review Gate]
[Audit Trail] ──requires──> [Engineering Review Gate]

[Document Version Tracking] ──conflicts──> [MVP scope] (defer to v2)
[Real-time Monitoring] ──conflicts──> [MVP scope] (explicitly out of scope)
```

### Dependency Notes

- **Document Ingestion requires AI Parsing:** No parsing means no downstream pipeline exists — this is the entry point for the entire workflow.
- **Legal Review Gate requires Obligation Extraction:** Lawyers review AI-extracted obligations, not raw documents. The extraction must happen before the gate opens.
- **RAG System Mapper requires Mock Service Corpus:** The vector store must be seeded with service documentation before RAG-based mapping can produce meaningful suggestions.
- **Engineering Review Gate requires RAG System Mapper:** Engineers review and correct AI suggestions — there is nothing to review if the mapper hasn't run.
- **Systems x Obligations Matrix requires Engineering Review Gate:** The final output is the confirmed (human-validated) mapping, not the AI's initial suggestion.
- **Transparent Reasoning enhances both AI stages:** The reasoning display is a UI enhancement to existing processing — it does not block any other feature but must be built alongside parsing and mapping, not after.
- **Audit Trail requires both gates:** Audit log is only meaningful when there are human decisions to record.

---

## MVP Definition

### Launch With (v1) — Demo-ready prototype

- [x] Document ingestion via PDF upload — core entry point, everything else depends on it
- [x] AI-powered obligation extraction with inline citations — the primary AI value-add; legal professionals will evaluate the prototype on this
- [x] Transparent reasoning display (chain-of-thought visible in UI) — key differentiator; Harvey design principle; what makes RIDE feel trustworthy vs. black-box
- [x] Legal review gate (approve/reject/priority) with audit log — non-negotiable for compliance domain; validates human-in-the-loop thesis
- [x] Obligation-to-action-item transformation for approved items — bridges the gap between legal approval and engineering action
- [x] RAG-based system mapper with mock Wealthsimple service corpus — the novel technical differentiator; demonstrates systems thinking
- [x] Engineering review gate (confirm/correct/reassign) with audit log — second HITL gate; unique vs. competitor tools
- [x] Final systems x obligations impact matrix — the demo money shot; shows the full pipeline output in one view
- [x] Pipeline status view — lets demo viewers follow the document through all stages

### Add After Validation (v1.x)

- [ ] Document version comparison (regulation amendments) — triggered when real regulatory change management use case is validated
- [ ] Confidence scoring per obligation — show AI uncertainty to guide reviewer attention to low-confidence extractions
- [ ] Bulk obligation batch approval — triggered when legal reviewer feedback shows individual approval is too slow
- [ ] Export to PDF/CSV (impact matrix, obligation register) — triggered when compliance teams want to share output in existing workflows

### Future Consideration (v2+)

- [ ] Real regulatory feed monitoring (OSFI, FINTRAC, SEC, etc.) — requires vendor data relationships; validate manual ingestion value first
- [ ] Multi-tenancy and user authentication — validate single-org value before building multi-org infrastructure
- [ ] Real-time multi-user collaboration — validate sequential workflow adequacy first
- [ ] Integration with real GRC tools (ServiceNow, Archer) — validate standalone value before integration complexity
- [ ] Actual engineering ticket creation (Jira, Linear) — validate impact analysis accuracy before automating downstream action

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Document ingestion (PDF) | HIGH | LOW | P1 |
| Obligation extraction + citations | HIGH | HIGH | P1 |
| Transparent reasoning display | HIGH | MEDIUM | P1 |
| Legal review gate | HIGH | MEDIUM | P1 |
| RAG system mapper | HIGH | HIGH | P1 |
| Engineering review gate | HIGH | MEDIUM | P1 |
| Systems x obligations matrix | HIGH | MEDIUM | P1 |
| Pipeline status view | MEDIUM | LOW | P1 |
| Priority/severity classification | MEDIUM | LOW | P1 |
| Audit trail | MEDIUM | MEDIUM | P1 |
| Document version comparison | MEDIUM | HIGH | P2 |
| Confidence scoring per obligation | MEDIUM | MEDIUM | P2 |
| URL ingestion (in addition to PDF) | LOW | LOW | P2 |
| Bulk batch approval | LOW | MEDIUM | P3 |
| Export (PDF/CSV) | LOW | LOW | P3 |
| Real-time feed monitoring | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for demo launch
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Harvey AI | Ascent RegTech (AscentAI) | Thomson Reuters CoCounsel | Lexis+ with Protege | RIDE (Our Approach) |
|---------|-----------|--------------------------|--------------------------|--------------------|--------------------|
| Document ingestion | YES — upload + internal docs | YES — regulatory feed + upload | YES — Westlaw/Practical Law integration | YES — upload + LexisNexis corpus | YES — PDF upload (prototype) |
| Obligation extraction | YES — task-specific workflows | YES — obligations inventory, auto-generated | YES — structured work product | YES — issue lists, analysis | YES — AI extraction with citations |
| Inline citations | YES — Harvey's core trust mechanism, Shepardization via LexisNexis | PARTIAL — references regulatory text | YES — citation-backed outputs, good law check | YES — authoritative source linking | YES — citations to source document paragraphs |
| Transparent reasoning | YES — "thinking states" visible, chain-of-thought | NO — obligation outputs but not reasoning steps | PARTIAL — structured outputs, not step-by-step reasoning | PARTIAL — multi-agent but not fully visible | YES — step-by-step reasoning exposed per stage |
| Human review gate | YES — professional stays in judgment role | YES — compliance review workflows | YES — humans review before finalizing | YES — lawyers validate | YES — DUAL gates (legal + engineering) |
| Priority/triage routing | YES — intelligent routing by urgency | YES — applicability scoring, automatic routing | YES — escalation for high-risk matters | PARTIAL | YES — legal reviewer sets priority |
| Audit trail | YES — enterprise grade | YES — full audit trail for regulatory reporting | YES — documented work product trail | YES | YES — timestamped, attributed decisions |
| Internal system mapping | NO — maps to legal tasks, not engineering systems | PARTIAL — maps to GRC controls/policies (not engineering) | NO | NO | YES — RAG-based mapping to specific internal services (novel) |
| Engineering impact gate | NO | NO | NO | NO | YES — unique in the market |
| Systems x obligations matrix | NO | NO | NO | NO | YES — novel final output |
| Regulatory feed monitoring | YES — real-time regulatory updates | YES — horizon scanning (AscentHorizon) | YES — continuous updates via Westlaw | YES — real-time web + LexisNexis | NO — manual ingestion (prototype scope) |
| Multi-tenancy | YES — enterprise | YES — enterprise | YES — enterprise | YES — enterprise | NO — single-user demo |

---

## Sources

- Harvey AI design principles blog: https://www.harvey.ai/blog/how-we-approach-design-at-harvey (MEDIUM confidence — official source, verified via WebFetch)
- Harvey AI features overview: https://www.harvey.ai/ and https://www.msba.org/site/site/content/News-and-Publications/News/General-News/An_Overview_of_Harvey_AIs_Features_for_Lawyers.aspx (MEDIUM confidence — multiple sources agree)
- Ascent RegTech / AscentAI RLM Platform: https://www.ascentregtech.com/rlm-platform/ and https://www.businesswire.com/news/home/20250312197630/en/Ascent-Technologies-Rebrands-as-AscentAI (MEDIUM confidence — official press release + product page)
- Thomson Reuters CoCounsel, 1M users milestone: https://www.prnewswire.com/news-releases/one-million-professionals-turn-to-cocounsel-as-thomson-reuters-scales-ai-for-regulated-industries-302694903.html (MEDIUM confidence — official press release)
- Lexis+ with Protege general availability: https://www.globenewswire.com/news-release/2026/02/24/3243510/0/en/General-Availability-of-Lexis-with-Prot%C3%A9g%C3%A9-Sets-New-Standard-for-Automating-Legal-Work-with-Easy-to-Use-Authoritative-AI-Workflows.html (MEDIUM confidence — official release, Feb 2026)
- Human-in-the-loop financial services requirement: https://fintech.global/2026/01/08/ai-regulatory-compliance-priorities-financial-institutions-face-in-2026/ and https://fintech.global/2025/09/01/ai-boosts-compliance-but-human-judgment-stays-critical/ (MEDIUM confidence — multiple industry sources agree)
- FINRA 2026 AI governance: https://fintech.global/2025/12/31/why-finras-2026-report-puts-ai-governance-under-scrutiny/ (MEDIUM confidence — single industry source; regulatory document not directly verified)
- Audit trail and obligation tracking standards: https://www.shumaker.com/insight/client-alert-generative-artificial-intelligence-in-financial-services-a-practical-compliance-playbook-for-2026/ (LOW confidence — law firm advisory, not official regulator guidance)
- AI obligation extraction statistics (5.3 hours/obligation manual baseline): https://auditboard.com/blog/how-ai-helps-solve-the-4-biggest-challenges-in-regulatory-compliance (LOW confidence — vendor-published, no primary source cited)
- Autonomous compliance risks: https://law-ai.org/automated-compliance-and-the-regulation-of-ai/ (MEDIUM confidence — academic/policy institute source)

---

*Feature research for: RIDE — Regulatory Integrated Development Environment (Wealthsimple prototype)*
*Researched: 2026-03-02*
