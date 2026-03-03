import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ride.db.session import async_session_maker, get_db
from ride.kafka.topics import KafkaTopic
from ride.models.audit_log import AuditLog
from ride.models.obligation import Obligation

router = APIRouter(prefix="/api/obligations", tags=["obligations"])


class ReviewRequest(BaseModel):
    action: Literal["approved", "rejected"]
    actor: str = "legal-reviewer"


@router.get("")
async def list_obligations(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008 — standard FastAPI dependency pattern
) -> list[dict]:
    """List all obligations for a given document, ordered by created_at."""
    result = await db.execute(
        select(Obligation)
        .where(Obligation.document_id == document_id)
        .order_by(Obligation.created_at)
    )
    obligations = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "document_id": str(o.document_id),
            "text": o.text,
            "source_quote": o.source_quote,
            "reasoning": o.reasoning,
            "status": o.status,
            "is_ambiguous": o.is_ambiguous,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in obligations
    ]


@router.get("/{obligation_id}")
async def get_obligation(obligation_id: uuid.UUID) -> dict:
    """Fetch a single obligation by ID."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Obligation).where(Obligation.id == obligation_id)
        )
        obligation = result.scalar_one_or_none()

    if not obligation:
        raise HTTPException(status_code=404, detail="Obligation not found")

    return {
        "id": str(obligation.id),
        "document_id": str(obligation.document_id),
        "text": obligation.text,
        "source_quote": obligation.source_quote,
        "reasoning": obligation.reasoning,
        "status": obligation.status,
        "is_ambiguous": obligation.is_ambiguous,
        "created_at": obligation.created_at.isoformat() if obligation.created_at else None,
    }


@router.patch("/{obligation_id}/review")
async def review_obligation(
    obligation_id: uuid.UUID,
    body: ReviewRequest,
    request: Request,
) -> dict:
    """Approve or reject an obligation with atomic audit logging.

    Both the obligation status update and the AuditLog insert are committed in a single
    database transaction (async with session.begin()). Kafka event is emitted only after
    the transaction commits successfully.
    """
    async with async_session_maker() as session:
        async with session.begin():
            result = await session.execute(
                select(Obligation).where(Obligation.id == obligation_id)
            )
            obligation = result.scalar_one_or_none()

            if not obligation:
                raise HTTPException(status_code=404, detail="Obligation not found")

            if obligation.status != "pending":
                raise HTTPException(
                    status_code=409,
                    detail=f"Obligation already reviewed (status: {obligation.status})",
                )

            # Atomic dual-write: update status + insert audit log in same transaction
            obligation.status = body.action
            session.add(
                AuditLog(
                    entity_type="obligation",
                    entity_id=obligation_id,
                    action=body.action,
                    actor=body.actor,
                    metadata_={"previous_status": "pending"},
                )
            )
        # Transaction committed here — safe to snapshot values for response and Kafka

        obligation_snapshot = {
            "id": str(obligation.id),
            "document_id": str(obligation.document_id),
            "text": obligation.text,
            "source_quote": obligation.source_quote,
            "reasoning": obligation.reasoning,
            "status": obligation.status,
            "is_ambiguous": obligation.is_ambiguous,
            "created_at": obligation.created_at.isoformat() if obligation.created_at else None,
        }

    # Emit Kafka event AFTER transaction commits — only for approved actions
    if body.action == "approved":
        await request.app.state.kafka_producer.send(
            KafkaTopic.OBLIGATION_APPROVED,
            {
                "obligation_id": str(obligation_id),
                "document_id": obligation_snapshot["document_id"],
            },
        )

    return obligation_snapshot
