import asyncio
import logging
import uuid

from anthropic import Anthropic
from sqlalchemy import select

from ride.config import settings
from ride.db.session import async_session_maker
from ride.kafka.consumer import BaseConsumer
from ride.kafka.producer import BaseProducer
from ride.kafka.topics import KafkaTopic
from ride.models.action_item import ActionItem
from ride.models.obligation import Obligation
from ride.schemas.action_item import ACTION_ITEM_PROMPT, ActionItemOutput

logger = logging.getLogger(__name__)


class ActionItemWorker(BaseConsumer):
    """Consumes OBLIGATION_APPROVED events, generates action items via Claude, emits ACTION_ITEM_GENERATED."""  # noqa: E501

    def __init__(self) -> None:
        super().__init__(KafkaTopic.OBLIGATION_APPROVED, group_id="action-item-worker")
        # Separate producer for emitting ACTION_ITEM_GENERATED — started/stopped in start()/stop()
        self._emit_producer = BaseProducer()
        self._client = Anthropic(api_key=settings.anthropic_api_key)

    async def start(self) -> None:
        await super().start()
        await self._emit_producer.start()

    async def stop(self) -> None:
        await self._emit_producer.stop()
        await super().stop()

    async def process(self, message: dict) -> None:
        obligation_id: str = message["obligation_id"]

        # Fetch obligation from DB
        async with async_session_maker() as session:
            result = await session.execute(
                select(Obligation).where(Obligation.id == uuid.UUID(obligation_id))
            )
            obligation = result.scalar_one_or_none()

        if not obligation:
            logger.warning("Obligation %s not found — skipping action item generation", obligation_id)
            return

        logger.info("Generating action item for obligation %s", obligation_id)

        # Call Claude via asyncio.to_thread — SDK is synchronous; wrapping avoids blocking event loop
        action_item_output: ActionItemOutput = await asyncio.to_thread(
            self._generate_action_item, obligation
        )

        # Persist ActionItem to DB
        async with async_session_maker() as session:
            action_item = ActionItem(
                obligation_id=uuid.UUID(obligation_id),
                description=action_item_output.description,
                status="pending",
            )
            session.add(action_item)
            await session.commit()
            await session.refresh(action_item)

        logger.info(
            "Persisted ActionItem %s for obligation %s",
            action_item.id,
            obligation_id,
        )

        # Emit downstream event
        await self._emit_producer.send(
            KafkaTopic.ACTION_ITEM_GENERATED,
            {
                "action_item_id": str(action_item.id),
                "obligation_id": str(obligation_id),
            },
        )
        logger.info(
            "Emitted ACTION_ITEM_GENERATED for action item %s",
            action_item.id,
        )

    def _generate_action_item(self, obligation: Obligation) -> ActionItemOutput:
        """Synchronous Claude call — run via asyncio.to_thread to avoid blocking the event loop."""
        response = self._client.messages.parse(
            model=settings.claude_model,
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": ACTION_ITEM_PROMPT.format(
                        obligation_text=obligation.text,
                        source_quote=obligation.source_quote,
                    ),
                }
            ],
            output_format=ActionItemOutput,
        )
        return response.parsed_output
