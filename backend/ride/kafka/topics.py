from enum import StrEnum


class KafkaTopic(StrEnum):
    # Primary topics
    DOCUMENT_UPLOADED = "ride.document.uploaded"
    DOCUMENT_PARSED = "ride.document.parsed"
    OBLIGATION_EXTRACTED = "ride.obligation.extracted"
    OBLIGATION_APPROVED = "ride.obligation.approved"
    ACTION_ITEM_GENERATED = "ride.action.item.generated"
    SYSTEM_MAPPING_PROPOSED = "ride.system.mapping.proposed"
    SYSTEM_MAPPING_CONFIRMED = "ride.system.mapping.confirmed"
    IMPACT_MATRIX_READY = "ride.impact.matrix.ready"

    # Dead letter queue (DLQ) topics
    DOCUMENT_UPLOADED_DLQ = "ride.document.uploaded.dlq"
    DOCUMENT_PARSED_DLQ = "ride.document.parsed.dlq"
    OBLIGATION_EXTRACTED_DLQ = "ride.obligation.extracted.dlq"
    OBLIGATION_APPROVED_DLQ = "ride.obligation.approved.dlq"
    ACTION_ITEM_GENERATED_DLQ = "ride.action.item.generated.dlq"
    SYSTEM_MAPPING_PROPOSED_DLQ = "ride.system.mapping.proposed.dlq"
    SYSTEM_MAPPING_CONFIRMED_DLQ = "ride.system.mapping.confirmed.dlq"
    IMPACT_MATRIX_READY_DLQ = "ride.impact.matrix.ready.dlq"


ALL_TOPICS: list[KafkaTopic] = list(KafkaTopic)
