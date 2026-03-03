# RIDE: Entity Relationship Diagram

Shows the core domain entities and their relationships. The data model follows the pipeline flow: Documents contain Obligations, which generate ActionItems, which are mapped to Systems. AuditLog provides polymorphic audit trailing across entities.

```mermaid
erDiagram
    Document {
        uuid id PK
        text filename
        text original_url
        text content_markdown
        string status "uploaded | parsed | extracted"
        datetime uploaded_at
        datetime updated_at
    }

    Obligation {
        uuid id PK
        uuid document_id FK
        text text
        text source_quote
        text reasoning
        string status "pending | approved | rejected"
        boolean is_ambiguous
        datetime created_at
        datetime updated_at
    }

    ActionItem {
        uuid id PK
        uuid obligation_id FK
        text description
        text owner
        datetime deadline
        string status "pending | complete"
        datetime created_at
    }

    SystemMapping {
        uuid id PK
        uuid action_item_id FK
        text system_name
        float confidence_score
        text matched_chunk "RAG evidence"
        string suggested_by "rag | engineer"
        boolean confirmed
        text engineer_note
        datetime reviewed_at
        datetime created_at
    }

    AuditLog {
        uuid id PK
        string entity_type "obligation | system_mapping"
        uuid entity_id
        string action "approved | rejected | confirmed | corrected | reassigned"
        string actor
        jsonb metadata
        datetime created_at
    }

    Document ||--o{ Obligation : "contains"
    Obligation ||--o| ActionItem : "generates"
    ActionItem ||--o{ SystemMapping : "mapped to"
    Obligation ||--o{ AuditLog : "audited by"
    SystemMapping ||--o{ AuditLog : "audited by"
```

## Key Relationships

| Relationship | Cardinality | Notes |
|-------------|-------------|-------|
| Document -> Obligation | 1:N | One regulatory document yields many obligations |
| Obligation -> ActionItem | 1:1 | Each approved obligation generates one action item |
| ActionItem -> SystemMapping | 1:N | One action item may affect multiple systems |
| AuditLog -> (polymorphic) | N:1 | Tracks actions on Obligations and SystemMappings via entity_type + entity_id |
