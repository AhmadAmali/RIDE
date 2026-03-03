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
from ride.models.document import Document
from ride.models.obligation import Obligation
from ride.schemas.obligation import (
    EXTRACTION_PROMPT,
    ObligationItem,
    ObligationList,
    chunk_markdown,
)

logger = logging.getLogger(__name__)


class ExtractWorker(BaseConsumer):
    """Consumes DOCUMENT_PARSED events, extracts obligations via Claude, emits OBLIGATION_EXTRACTED."""  # noqa: E501

    def __init__(self) -> None:
        super().__init__(KafkaTopic.DOCUMENT_PARSED, group_id="extract-worker")
        # Separate producer for emitting OBLIGATION_EXTRACTED — started/stopped in start()/stop()
        self._emit_producer = BaseProducer()
        self._client = Anthropic(api_key=settings.anthropic_api_key)

    async def start(self) -> None:
        await super().start()
        await self._emit_producer.start()

    async def stop(self) -> None:
        await self._emit_producer.stop()
        await super().stop()

    async def process(self, message: dict) -> None:
        doc_id: str = message["document_id"]

        # Fetch document Markdown from DB
        async with async_session_maker() as session:
            result = await session.execute(
                select(Document).where(Document.id == uuid.UUID(doc_id))
            )
            doc = result.scalar_one()
            content_markdown = doc.content_markdown

        if not content_markdown:
            logger.warning("Document %s has no content_markdown — skipping extraction", doc_id)
            return

        # Chunk the Markdown into overlapping windows (~16K chars, 1.6K overlap)
        chunks = chunk_markdown(content_markdown)
        logger.info("Extracting obligations from document %s (%d chunks)", doc_id, len(chunks))

        # Extract obligations from each chunk via Claude (SDK is synchronous — use to_thread)
        all_obligations: list[ObligationItem] = []
        for i, chunk in enumerate(chunks):
            chunk_obligations = await asyncio.to_thread(self._extract_chunk, chunk)
            logger.info("Chunk %d/%d: %d obligations", i + 1, len(chunks), len(chunk_obligations))

            # Deduplicate across overlapping chunks: skip if source_quote is a substring of
            # an already-collected quote or vice versa (>80% overlap via containment check)
            for new_item in chunk_obligations:
                duplicate = False
                for existing in all_obligations:
                    if (
                        new_item.source_quote in existing.source_quote
                        or existing.source_quote in new_item.source_quote
                    ):
                        duplicate = True
                        break
                if not duplicate:
                    all_obligations.append(new_item)

        logger.info(
            "Document %s: %d unique obligations after deduplication", doc_id, len(all_obligations)
        )

        # Persist obligations and update document status to "extracted"
        async with async_session_maker() as session:
            for item in all_obligations:
                obligation = Obligation(
                    document_id=uuid.UUID(doc_id),
                    text=item.text,
                    source_quote=item.source_quote,
                    reasoning=item.reasoning,
                    is_ambiguous=item.is_ambiguous,
                    status="pending",
                )
                session.add(obligation)

            # Re-fetch doc in same session to update status
            result = await session.execute(
                select(Document).where(Document.id == uuid.UUID(doc_id))
            )
            doc = result.scalar_one()
            doc.status = "extracted"
            await session.commit()

        # Emit downstream event
        await self._emit_producer.send(
            KafkaTopic.OBLIGATION_EXTRACTED,
            {"document_id": doc_id, "obligation_count": len(all_obligations)},
        )
        logger.info(
            "Emitted OBLIGATION_EXTRACTED for document %s with %d obligations",
            doc_id,
            len(all_obligations),
        )

    def _extract_chunk(self, chunk_text: str) -> list[ObligationItem]:
        """Synchronous Claude call — run via asyncio.to_thread to avoid blocking the event loop."""
        response = self._client.messages.parse(
            model=settings.claude_model,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT.format(chunk=chunk_text),
                }
            ],
            output_format=ObligationList,
        )
        return response.parsed_output.obligations
