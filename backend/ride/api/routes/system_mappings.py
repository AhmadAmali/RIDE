import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ride.db.session import async_session_maker, get_db
from ride.kafka.topics import KafkaTopic
from ride.models.action_item import ActionItem
from ride.models.audit_log import AuditLog
from ride.models.obligation import Obligation
from ride.models.system_mapping import SystemMapping

router = APIRouter(prefix="/api/system-mappings", tags=["system-mappings"])

# Separate router for action items (co-located since it's used by the engineering review page)
action_items_router = APIRouter(prefix="/api/action-items", tags=["action-items"])


class EngineeringReviewRequest(BaseModel):
    action: Literal["confirmed", "corrected", "reassigned"]
    actor: str = "engineer"
    corrected_system: str | None = None
    reason: str | None = None


@router.get("")
async def list_system_mappings(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[dict]:
    """List all system mappings for a given document, ordered by created_at.

    Joins through ActionItem -> Obligation to filter by document_id.
    Includes parent action_item description for UI context.
    """
    result = await db.execute(
        select(SystemMapping, ActionItem.description)
        .join(ActionItem, SystemMapping.action_item_id == ActionItem.id)
        .join(Obligation, ActionItem.obligation_id == Obligation.id)
        .where(Obligation.document_id == document_id)
        .order_by(SystemMapping.created_at)
    )
    rows = result.all()
    return [
        {
            "id": str(mapping.id),
            "action_item_id": str(mapping.action_item_id),
            "system_name": mapping.system_name,
            "confidence_score": mapping.confidence_score,
            "matched_chunk": mapping.matched_chunk,
            "suggested_by": mapping.suggested_by,
            "confirmed": mapping.confirmed,
            "engineer_note": mapping.engineer_note,
            "created_at": mapping.created_at.isoformat() if mapping.created_at else None,
            "reviewed_at": mapping.reviewed_at.isoformat() if mapping.reviewed_at else None,
            "action_item_description": action_item_desc,
        }
        for mapping, action_item_desc in rows
    ]


@action_items_router.get("")
async def list_action_items(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[dict]:
    """List action items for a document. Joins through Obligation to filter by document_id."""
    result = await db.execute(
        select(ActionItem)
        .join(Obligation, ActionItem.obligation_id == Obligation.id)
        .where(Obligation.document_id == document_id)
        .order_by(ActionItem.created_at)
    )
    action_items = result.scalars().all()
    return [
        {
            "id": str(ai.id),
            "obligation_id": str(ai.obligation_id),
            "description": ai.description,
            "owner": ai.owner,
            "deadline": ai.deadline.isoformat() if ai.deadline else None,
            "status": ai.status,
            "created_at": ai.created_at.isoformat() if ai.created_at else None,
        }
        for ai in action_items
    ]


@router.patch("/{mapping_id}/review")
async def review_system_mapping(
    mapping_id: uuid.UUID,
    body: EngineeringReviewRequest,
    request: Request,
) -> dict:
    """Confirm, correct, or reassign a system mapping with atomic audit logging.

    Both the mapping update and the AuditLog insert are committed in a single
    database transaction (async with session.begin()). Kafka event is emitted only
    after the transaction commits successfully.
    """
    # Validate: corrected/reassigned actions require corrected_system and reason
    if body.action in ("corrected", "reassigned"):
        if not body.corrected_system:
            raise HTTPException(
                status_code=422,
                detail="corrected_system is required for corrected/reassigned actions",
            )
        if not body.reason:
            raise HTTPException(
                status_code=422,
                detail="reason is required for corrected/reassigned actions",
            )

    async with async_session_maker() as session:
        async with session.begin():
            result = await session.execute(
                select(SystemMapping).where(SystemMapping.id == mapping_id)
            )
            mapping = result.scalar_one_or_none()

            if not mapping:
                raise HTTPException(status_code=404, detail="System mapping not found")

            if mapping.confirmed:
                raise HTTPException(
                    status_code=409,
                    detail="System mapping already reviewed (confirmed)",
                )

            # Track previous system name for audit metadata
            previous_system = mapping.system_name

            # Update mapping
            mapping.confirmed = True
            mapping.reviewed_at = func.now()

            if body.action in ("corrected", "reassigned"):
                mapping.system_name = body.corrected_system
                mapping.engineer_note = body.reason
                mapping.suggested_by = "engineer"

            # Atomic dual-write: update mapping + insert audit log in same transaction
            audit_metadata = None
            if body.action in ("corrected", "reassigned"):
                audit_metadata = {"previous_system": previous_system}

            session.add(
                AuditLog(
                    entity_type="system_mapping",
                    entity_id=mapping_id,
                    action=body.action,
                    actor=body.actor,
                    metadata_=audit_metadata,
                )
            )

            # Build snapshot BEFORE commit expires ORM attributes
            mapping_snapshot = {
                "id": str(mapping.id),
                "action_item_id": str(mapping.action_item_id),
                "system_name": mapping.system_name,
                "confidence_score": mapping.confidence_score,
                "matched_chunk": mapping.matched_chunk,
                "suggested_by": mapping.suggested_by,
                "confirmed": mapping.confirmed,
                "engineer_note": mapping.engineer_note,
                "created_at": mapping.created_at.isoformat() if mapping.created_at else None,
                "reviewed_at": None,  # func.now() is server-side; not yet available
            }
        # Transaction committed here

    # Emit Kafka event AFTER transaction commits
    await request.app.state.kafka_producer.send(
        KafkaTopic.SYSTEM_MAPPING_CONFIRMED,
        {
            "mapping_id": str(mapping_id),
            "action_item_id": mapping_snapshot["action_item_id"],
        },
    )

    return mapping_snapshot
