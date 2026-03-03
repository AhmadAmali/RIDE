# RIDE: Event-Driven Pipeline Flow

Shows the complete document processing pipeline from upload through impact matrix generation. Two human-in-the-loop (HITL) gates ensure transparency: legal reviewers approve obligations, engineers confirm system mappings. Dead letter queues (DLQ) handle worker failures at each stage.

```mermaid
flowchart LR
    Upload["User Upload\n(PDF)"]
    Parse["ParseWorker"]
    Extract["ExtractWorker\n(Claude API)"]
    LegalGate{"Legal Review\nGate (HITL)"}
    ActionItem["ActionItemWorker\n(Claude API)"]
    RagMapper["RagMapperWorker\n(Qdrant)"]
    EngGate{"Engineering Review\nGate (HITL)"}
    Matrix["Impact\nMatrix"]

    Upload -->|"ride.document.uploaded"| Parse
    Parse -->|"ride.document.parsed"| Extract
    Extract -->|"ride.obligation.extracted"| LegalGate
    LegalGate -->|"ride.obligation.approved"| ActionItem
    ActionItem -->|"ride.action.item.generated"| RagMapper
    RagMapper -->|"ride.system.mapping.proposed"| EngGate
    EngGate -->|"ride.system.mapping.confirmed"| Matrix

    %% DLQ branches
    Parse -.->|"failure"| DLQ1["DLQ:\nride.document.uploaded.dlq"]
    Extract -.->|"failure"| DLQ2["DLQ:\nride.document.parsed.dlq"]
    ActionItem -.->|"failure"| DLQ3["DLQ:\nride.obligation.approved.dlq"]
    RagMapper -.->|"failure"| DLQ4["DLQ:\nride.action.item.generated.dlq"]

    %% Styling
    style LegalGate fill:#f59e0b,stroke:#d97706,color:#000
    style EngGate fill:#f59e0b,stroke:#d97706,color:#000
    style Matrix fill:#14b8a6,stroke:#0d9488,color:#000
    style Upload fill:#3b82f6,stroke:#2563eb,color:#fff
    style DLQ1 fill:#ef4444,stroke:#dc2626,color:#fff
    style DLQ2 fill:#ef4444,stroke:#dc2626,color:#fff
    style DLQ3 fill:#ef4444,stroke:#dc2626,color:#fff
    style DLQ4 fill:#ef4444,stroke:#dc2626,color:#fff
```

## Pipeline Stages

| Stage | Kafka Topic | Worker | External Dependency |
|-------|------------|--------|-------------------|
| 1. Upload | `ride.document.uploaded` | ParseWorker | - |
| 2. Parse | `ride.document.parsed` | ExtractWorker | Claude API |
| 3. Extract | `ride.obligation.extracted` | (Legal Gate) | Human reviewer |
| 4. Legal Approve | `ride.obligation.approved` | ActionItemWorker | Claude API |
| 5. Action Items | `ride.action.item.generated` | RagMapperWorker | Qdrant |
| 6. RAG Map | `ride.system.mapping.proposed` | (Engineering Gate) | Human engineer |
| 7. Eng Confirm | `ride.system.mapping.confirmed` | Impact Matrix | - |
