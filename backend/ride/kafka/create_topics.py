"""Script to create all Kafka topics from the KafkaTopic StrEnum.

Run as: python -m ride.kafka.create_topics
"""

import asyncio
import logging

from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aiokafka.errors import TopicAlreadyExistsError

from ride.config import settings
from ride.kafka.topics import ALL_TOPICS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_topics() -> None:
    admin = AIOKafkaAdminClient(bootstrap_servers=settings.kafka_bootstrap_servers)
    await admin.start()

    try:
        new_topics = [
            NewTopic(name=str(topic), num_partitions=1, replication_factor=1)
            for topic in ALL_TOPICS
        ]
        try:
            await admin.create_topics(new_topics)
            logger.info("Created %d topics", len(ALL_TOPICS))
        except TopicAlreadyExistsError:
            logger.info("Some topics already exist — creating remaining topics individually")
            for topic in ALL_TOPICS:
                try:
                    await admin.create_topics(
                        [NewTopic(name=str(topic), num_partitions=1, replication_factor=1)]
                    )
                    logger.info("Created topic: %s", topic)
                except TopicAlreadyExistsError:
                    logger.info("Topic already exists (skipping): %s", topic)
    finally:
        await admin.close()


if __name__ == "__main__":
    asyncio.run(create_topics())
