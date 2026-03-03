import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ride.db.session import get_db
from ride.models.action_item import ActionItem
from ride.models.document import Document
from ride.models.obligation import Obligation
from ride.models.system_mapping import SystemMapping

router = APIRouter(prefix="/api/impact-matrix", tags=["impact-matrix"])


@router.get("")
async def get_impact_matrix(
    document_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> dict:
    """Return the systems-x-obligations impact matrix for confirmed mappings.

    Only includes mappings where confirmed=True (engineer-reviewed).
    If document_id is provided, filters to that document only.
    Corrected/reassigned mappings reflect the engineer's chosen system_name,
    not the original AI suggestion.
    """
    query = (
        select(
            SystemMapping.system_name,
            Obligation.id.label("obligation_id"),
            Obligation.text.label("obligation_text"),
            SystemMapping.confidence_score,
            SystemMapping.suggested_by,
            SystemMapping.engineer_note,
        )
        .join(ActionItem, SystemMapping.action_item_id == ActionItem.id)
        .join(Obligation, ActionItem.obligation_id == Obligation.id)
        .where(SystemMapping.confirmed == True)  # noqa: E712
    )

    if document_id:
        query = query.join(Document, Obligation.document_id == Document.id)
        query = query.where(Document.id == document_id)

    result = await db.execute(query)
    rows = result.all()

    # Build unique sorted systems list
    systems_set: set[str] = set()
    # Build unique obligations list (deduplicated by obligation_id)
    obligations_map: dict[str, dict] = {}
    # Build cells list
    cells: list[dict] = []

    for row in rows:
        systems_set.add(row.system_name)

        ob_id = str(row.obligation_id)
        if ob_id not in obligations_map:
            obligations_map[ob_id] = {
                "id": ob_id,
                "text": row.obligation_text,
            }

        cells.append(
            {
                "system_name": row.system_name,
                "obligation_id": ob_id,
                "obligation_text": row.obligation_text,
                "confidence_score": row.confidence_score,
                "suggested_by": row.suggested_by,
                "engineer_note": row.engineer_note,
            }
        )

    return {
        "systems": sorted(systems_set),
        "obligations": list(obligations_map.values()),
        "cells": cells,
    }
