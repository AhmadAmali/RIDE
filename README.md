# RIDE — Regulatory Integrated Development Environment

RIDE is an event-driven platform that ingests regulatory PDF documents, extracts legal obligations using AI, and maps them to internal engineering systems through a human-in-the-loop review pipeline.

## Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend — Next.js :3000"]
        Upload["Upload PDF"]
        LegalReview["Legal Review UI"]
        EngrReview["Engineering Review UI"]
        ImpactView["Impact Matrix UI"]
    end

    subgraph API["Backend API — FastAPI :8000"]
        DocRouter["/api/documents"]
        ObligRouter["/api/obligations"]
        ActionRouter["/api/action-items"]
        MapRouter["/api/system-mappings"]
        ImpactRouter["/api/impact-matrix"]
    end

    subgraph Kafka["Kafka Message Bus :9092"]
        T1(["document.uploaded"])
        T2(["document.parsed"])
        T3(["obligation.extracted"])
        T4(["obligation.approved"])
        T5(["action.item.generated"])
        T6(["system.mapping.proposed"])
    end

    subgraph Workers["Async Workers — Kafka Consumers"]
        W1["Parse Worker\npymupdf4llm"]
        W2["Extract Worker\nClaude API"]
        W3["Action Item Worker\nClaude API"]
        W4["RAG Mapper Worker\nQdrant search"]
    end

    subgraph Storage["Data Stores"]
        PG[("PostgreSQL :5432\ndocuments | obligations\naction_items | system_mappings\naudit_log")]
        QD[("Qdrant :6333\nwealthsimple_services\nBAAI/bge-small-en-v1.5")]
    end

    Claude["Claude API\nclaude-sonnet-4-5"]
    Corpus["Service Corpus\n/data/corpus/*.md"]

    %% Frontend → API
    Upload --> DocRouter
    LegalReview --> ObligRouter
    EngrReview --> MapRouter
    ImpactView --> ImpactRouter

    %% API → Kafka (event emission)
    DocRouter -- "emit" --> T1
    ObligRouter -- "emit" --> T4

    %% Worker pipeline
    T1 --> W1
    W1 -- "emit" --> T2
    T2 --> W2
    W2 -- "emit" --> T3
    T4 --> W3
    W3 -- "emit" --> T5
    T5 --> W4
    W4 -- "emit" --> T6

    %% Workers → DB
    W1 --> PG
    W2 --> PG
    W3 --> PG
    W4 --> PG

    %% API → DB
    DocRouter --> PG
    ObligRouter --> PG
    ActionRouter --> PG
    MapRouter --> PG
    ImpactRouter --> PG

    %% External
    W2 --> Claude
    W3 --> Claude
    W4 --> QD
    Corpus --> QD
```

## Data Flow

| Stage | Trigger | Actor | Output |
|-------|---------|-------|--------|
| **1. Upload** | User drops PDF | Frontend → API | `document.uploaded` event |
| **2. Parse** | `document.uploaded` | Parse Worker + pymupdf4llm | Markdown stored, `document.parsed` event |
| **3. Extract** | `document.parsed` | Extract Worker + Claude | Obligations created (status: pending) |
| **4. Legal Review** | Human approves/rejects | Legal reviewer via UI | `obligation.approved` event + audit log |
| **5. Action Items** | `obligation.approved` | Action Item Worker + Claude | Actionable tasks generated |
| **6. System Mapping** | `action.item.generated` | RAG Mapper + Qdrant | System mapping proposals with confidence scores |
| **7. Engineering Review** | Human confirms/corrects | Engineer via UI | Confirmed mappings + audit log |
| **8. Impact Matrix** | Query confirmed mappings | API aggregation | Systems x Obligations grid |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Tailwind CSS, shadcn/ui |
| Backend API | FastAPI, SQLAlchemy, Alembic |
| Message Queue | Apache Kafka (KRaft mode) |
| Database | PostgreSQL 16 |
| Vector Store | Qdrant + BAAI/bge-small-en-v1.5 |
| AI | Claude claude-sonnet-4-5 (structured output) |
| PDF Parsing | pymupdf4llm |
| Orchestration | Docker Compose |

## Getting Started

```bash
# Start all services
docker compose up -d

# Frontend:  http://localhost:3000
# Backend:   http://localhost:8000
# API docs:  http://localhost:8000/docs
# Qdrant:    http://localhost:6333/dashboard
```
