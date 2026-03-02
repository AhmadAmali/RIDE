# RIDE-Wealthsimple

## What This Is

RIDE (Regulatory Integrated Development Environment) is a polished prototype demonstrating an AI-native regulatory compliance workflow for Wealthsimple. It ingests financial regulatory documents, uses AI to parse and summarize obligations with transparent reasoning, routes them through a legal/compliance approval gate, maps approved action items to affected internal systems via RAG, and provides an engineering review gate for confirming system impact — transforming dense regulatory documents into prioritized, system-mapped business action items.

Built as a portfolio prototype for the Wealthsimple AI Builder role, demonstrating systems thinking, human-in-the-loop design, and cross-functional workflow redesign.

## Core Value

Turn any financial regulatory document into approved, system-mapped business action items through a transparent AI pipeline with two human-in-the-loop gates — legal approval and engineering confirmation — so compliance never becomes a black box.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Ingest regulatory documents via PDF upload or URL
- [ ] AI-powered document parsing and summarization with citations and transparent reasoning
- [ ] Legal/compliance review gate with approve/reject workflow and priority markings
- [ ] Transform approved obligations into structured business action items
- [ ] RAG-based system mapper trained on mock internal documentation corpus
- [ ] Multi-system mapping per action item (single regulation can touch multiple services)
- [ ] Engineering review gate to confirm/correct/reassign AI-suggested system mappings
- [ ] Final impact analysis view showing systems x action items matrix
- [ ] Mock Wealthsimple-like service landscape (KYC Service, Trading Engine, Tax Reporting, etc.)
- [ ] Polished, professional UI inspired by Harvey AI design principles (domain awareness, effortless complexity, intentional design)
- [ ] Architecture diagrams demonstrating systems thinking

### Out of Scope

- Actual code generation or PR creation — prototype stops at impact analysis
- Real Wealthsimple codebase integration — uses mock services and documentation
- Multiple scenario support — focused on one polished happy path
- User authentication or multi-tenancy — prototype is single-user demo
- Real-time regulatory feed monitoring — manual ingestion only
- Mobile responsiveness — desktop-focused demo

## Context

**Purpose:** Portfolio prototype for the Wealthsimple AI Builder role application. Must produce a 2-3 minute demo video showing one regulation flowing through the entire pipeline with polished UI, plus architecture diagrams demonstrating systems thinking.

**Job context:** The role is about identifying legacy business processes and redesigning them as AI-native workflows. The regulatory compliance pipeline (regulation → legal review → engineering action) is a prime example of a process that "wouldn't exist like this if built today." The prototype must demonstrate explicit decisions about where AI has responsibility vs. human control.

**Design inspiration:** Harvey AI's design principles:
- **Domain awareness** — design for the standards of legal professionals, familiar yet modern
- **Effortless complexity** — surface sophisticated functionality without sacrificing user control
- **Intentional design** — every element serves a purpose, transparency and accountability throughout
- **Transparent reasoning** — show AI's thinking steps and citations, backtrackable logic
- **Human retains judgment** — AI classifies and organizes, humans decide and approve

**Two human-in-the-loop gates:**
1. **Legal gate** — Legal/compliance reviews AI summaries, approves/rejects obligations, sets priority. AI cannot autonomously decide what a regulation requires.
2. **Engineering gate** — Engineers review RAG-suggested system mappings, confirm/correct/add systems. AI can't reliably navigate a massive codebase, so humans guide the mapping.

**RAG architecture:** The system mapper uses a vector store of mock internal documentation (service descriptions, API specs, architecture docs) to suggest which Wealthsimple-like systems are affected. A single regulatory change may map to multiple systems simultaneously.

## Constraints

- **Tech stack**: Next.js frontend + Python backend + Claude API + Kafka for async messaging
- **LLM provider**: Anthropic Claude API for document processing
- **Async messaging**: Kafka for pipeline stage communication
- **Demo format**: 2-3 minute video — one polished end-to-end flow
- **Timeline**: Prototype scope — build for demo quality, not production hardening
- **Data**: Mock Wealthsimple service documentation and regulatory documents

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two human-in-the-loop gates (legal + engineering) | AI can't reliably interpret legal obligations or map to correct systems in a massive codebase — honest about AI limitations | — Pending |
| Claude API as LLM provider | Strong document analysis, structured output, citation support | — Pending |
| Kafka for async messaging | Realistic architecture for event-driven regulatory pipeline; demonstrates systems thinking | — Pending |
| Mock Wealthsimple services for RAG | Realistic demo without needing actual internal access | — Pending |
| Harvey AI design principles as UI inspiration | Industry-leading legal AI UX patterns — domain awareness, transparent reasoning, human judgment | — Pending |
| Next.js + Python split | Next.js for polished UI (demo priority), Python for AI/RAG pipeline | — Pending |

---
*Last updated: 2026-03-02 after initialization*
