import asyncio
import uuid

import pymupdf4llm
from sqlalchemy import select

from ride.db.session import async_session_maker
from ride.kafka.consumer import BaseConsumer
from ride.kafka.producer import BaseProducer
from ride.kafka.topics import KafkaTopic
from ride.models.document import Document


class ParseWorker(BaseConsumer):
    """Consumes DOCUMENT_UPLOADED events, converts PDF to Markdown, emits DOCUMENT_PARSED."""

    def __init__(self) -> None:
        super().__init__(KafkaTopic.DOCUMENT_UPLOADED, group_id="parse-worker")
        # Separate producer for emitting DOCUMENT_PARSED — started/stopped in start()/stop()
        self._emit_producer = BaseProducer()

    async def start(self) -> None:
        await super().start()
        await self._emit_producer.start()

    async def stop(self) -> None:
        await self._emit_producer.stop()
        await super().stop()

    async def process(self, message: dict) -> None:
        doc_id: str = message["document_id"]
        file_path: str = message["file_path"]

        # Convert PDF to structure-preserving Markdown.
        # pymupdf4llm.to_markdown is synchronous — run in a thread to avoid blocking the loop.
        md_text: str = await asyncio.to_thread(pymupdf4llm.to_markdown, file_path)

        # Persist Markdown and update status to "parsed"
        async with async_session_maker() as session:
            result = await session.execute(
                select(Document).where(Document.id == uuid.UUID(doc_id))
            )
            doc = result.scalar_one()
            doc.content_markdown = md_text
            doc.status = "parsed"
            await session.commit()

        # Emit next-stage event
        await self._emit_producer.send(
            KafkaTopic.DOCUMENT_PARSED,
            {"document_id": doc_id},
        )
