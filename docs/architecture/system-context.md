# RIDE: System Context Diagram

Shows the external actors, services, and infrastructure that comprise the RIDE system. The architecture follows a microservices-inspired pattern with an event bus (Kafka) decoupling the processing stages.

```mermaid
flowchart TB
    subgraph External
        User["User\n(Legal Reviewer / Engineer)"]
        Claude["Claude API\n(Anthropic)"]
    end

    subgraph Frontend["Next.js Frontend (port 3000)"]
        DocList["Document List\n+ Upload"]
        LegalReview["Legal Review\nSplit Panel"]
        EngReview["Engineering Review\nSplit Panel"]
        ImpactView["Impact Analysis\nMatrix"]
    end

    subgraph Backend["FastAPI Backend (port 8000)"]
        API["REST API\n/api/*"]
        subgraph Workers["Async Workers (lifespan tasks)"]
            PW["ParseWorker"]
            EW["ExtractWorker"]
            AIW["ActionItemWorker"]
            RMW["RagMapperWorker"]
        end
    end

    subgraph Infrastructure
        PG["PostgreSQL\n(documents, obligations,\naction_items, system_mappings,\naudit_log)"]
        Kafka["Kafka\n(KRaft mode,\nevent bus)"]
        Qdrant["Qdrant\n(vector search,\nservice corpus)"]
    end

    User --> Frontend
    Frontend -->|"HTTP REST"| API
    API --> PG
    API --> Kafka

    PW --> PG
    PW <--> Kafka
    EW --> PG
    EW <--> Kafka
    EW --> Claude
    AIW --> PG
    AIW <--> Kafka
    AIW --> Claude
    RMW --> PG
    RMW <--> Kafka
    RMW --> Qdrant

    %% Styling
    style User fill:#3b82f6,stroke:#2563eb,color:#fff
    style Claude fill:#6366f1,stroke:#4f46e5,color:#fff
    style PG fill:#22c55e,stroke:#16a34a,color:#000
    style Kafka fill:#f97316,stroke:#ea580c,color:#000
    style Qdrant fill:#a855f7,stroke:#9333ea,color:#fff
```

## Technology Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend | Next.js 15, React, Tailwind CSS | Server-rendered UI with client interactivity |
| Backend API | FastAPI, SQLAlchemy 2.0 (async) | REST endpoints, worker orchestration |
| Database | PostgreSQL 16 | Persistent storage for all domain entities |
| Event Bus | Apache Kafka 3.9.2 (KRaft) | Decoupled async pipeline communication |
| Vector DB | Qdrant | RAG corpus storage and similarity search |
| AI | Claude (Anthropic) | Obligation extraction, action item generation |
| Container | Docker Compose | Development orchestration |
