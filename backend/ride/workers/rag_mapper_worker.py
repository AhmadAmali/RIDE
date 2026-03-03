import logging
import uuid

from qdrant_client import AsyncQdrantClient
from sqlalchemy import select

from ride.db.session import async_session_maker
from ride.kafka.consumer import BaseConsumer
from ride.kafka.producer import BaseProducer
from ride.kafka.topics import KafkaTopic
from ride.models.action_item import ActionItem
from ride.models.system_mapping import SystemMapping
from ride.rag.corpus_indexer import COLLECTION_NAME

logger = logging.getLogger(__name__)

# Minimum Qdrant similarity score for a system mapping to be persisted
_CONFIDENCE_THRESHOLD = 0.5
# Maximum number of Qdrant results to consider per action item
_QUERY_LIMIT = 3


class RagMapperWorker(BaseConsumer):
    """Consumes ACTION_ITEM_GENERATED events, queries Qdrant for matching services,
    persists SystemMapping rows above confidence threshold, emits SYSTEM_MAPPING_PROPOSED."""  # noqa: E501

    def __init__(self, qdrant_client: AsyncQdrantClient) -> None:
        super().__init__(KafkaTopic.ACTION_ITEM_GENERATED, group_id="rag-mapper-worker")
        # Qdrant client is shared from lifespan — do NOT create a new client per-worker
        self._qdrant = qdrant_client
        # Separate producer for emitting SYSTEM_MAPPING_PROPOSED
        self._emit_producer = BaseProducer()

    async def start(self) -> None:
        await super().start()
        await self._emit_producer.start()

    async def stop(self) -> None:
        await self._emit_producer.stop()
        await super().stop()

    async def process(self, message: dict) -> None:
        action_item_id: str = message["action_item_id"]

        # Fetch action item from DB
        async with async_session_maker() as session:
            result = await session.execute(
                select(ActionItem).where(ActionItem.id == uuid.UUID(action_item_id))
            )
            action_item = result.scalar_one_or_none()

        if not action_item:
            logger.warning(
                "ActionItem %s not found — skipping RAG mapping", action_item_id
            )
            return

        logger.info(
            "Querying Qdrant for action item %s: %s",
            action_item_id,
            action_item.description[:80],
        )

        # Query Qdrant for top matching service documents
        results = await self._qdrant.query(
            collection_name=COLLECTION_NAME,
            query_text=action_item.description,
            limit=_QUERY_LIMIT,
        )

        # Filter to results above confidence threshold
        above_threshold = [r for r in results if r.score >= _CONFIDENCE_THRESHOLD]

        logger.info(
            "Action item %s: %d/%d Qdrant results above %.1f threshold",
            action_item_id,
            len(above_threshold),
            len(results),
            _CONFIDENCE_THRESHOLD,
        )

        # Persist SystemMapping rows for results above threshold
        if above_threshold:
            async with async_session_maker() as session:
                for result in above_threshold:
                    mapping = SystemMapping(
                        action_item_id=uuid.UUID(action_item_id),
                        system_name=result.metadata.get("service", "unknown"),
                        confidence_score=result.score,
                        suggested_by="rag",
                        confirmed=False,
                    )
                    session.add(mapping)
                await session.commit()

        # Emit downstream event with mapping count
        await self._emit_producer.send(
            KafkaTopic.SYSTEM_MAPPING_PROPOSED,
            {
                "action_item_id": str(action_item_id),
                "mapping_count": len(above_threshold),
            },
        )
        logger.info(
            "Emitted SYSTEM_MAPPING_PROPOSED for action item %s (%d mappings)",
            action_item_id,
            len(above_threshold),
        )
