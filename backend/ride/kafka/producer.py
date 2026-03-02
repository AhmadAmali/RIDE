import json

from aiokafka import AIOKafkaProducer

from ride.config import settings
from ride.kafka.topics import KafkaTopic


class BaseProducer:
    def __init__(self) -> None:
        self._producer: AIOKafkaProducer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
        )

    async def start(self) -> None:
        await self._producer.start()

    async def stop(self) -> None:
        await self._producer.stop()

    async def send(self, topic: KafkaTopic, message: dict) -> None:
        value = json.dumps(message).encode("utf-8")
        await self._producer.send_and_wait(str(topic), value=value)
