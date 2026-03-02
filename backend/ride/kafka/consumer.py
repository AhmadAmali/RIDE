import json
import traceback
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from ride.config import settings
from ride.kafka.topics import KafkaTopic


class BaseConsumer(ABC):
    def __init__(self, topic: KafkaTopic, group_id: str) -> None:
        self._topic = topic
        self._group_id = group_id
        self._dlq_topic = KafkaTopic(str(topic) + ".dlq")

        self._consumer: AIOKafkaConsumer = AIOKafkaConsumer(
            str(topic),
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=group_id,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
        )
        self._dlq_producer: AIOKafkaProducer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
        )

    @abstractmethod
    async def process(self, message: dict) -> None:
        """Process a single message. Override in subclasses."""

    async def run(self) -> None:
        """Consume messages indefinitely with at-least-once delivery and DLQ routing."""
        async for msg in self._consumer:
            try:
                payload = json.loads(msg.value.decode("utf-8"))
                await self.process(payload)
                await self._consumer.commit()
            except Exception as exc:
                error_envelope = {
                    "original_topic": str(self._topic),
                    "offset": msg.offset,
                    "partition": msg.partition,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                    "failed_at": datetime.now(tz=UTC).isoformat(),
                    "payload": msg.value.decode("utf-8", errors="replace"),
                }
                dlq_value = json.dumps(error_envelope).encode("utf-8")
                await self._dlq_producer.send_and_wait(str(self._dlq_topic), value=dlq_value)
                # Commit after routing to DLQ to avoid infinite retry loops
                await self._consumer.commit()

    async def start(self) -> None:
        await self._consumer.start()
        await self._dlq_producer.start()

    async def stop(self) -> None:
        await self._consumer.stop()
        await self._dlq_producer.stop()
