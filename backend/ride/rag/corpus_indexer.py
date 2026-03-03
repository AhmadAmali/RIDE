import logging
from pathlib import Path

from qdrant_client import AsyncQdrantClient

logger = logging.getLogger(__name__)

COLLECTION_NAME = "wealthsimple_services"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def _chunk_text(text: str, chunk_chars: int = 800, overlap: int = 100) -> list[str]:
    """Split text into character-based chunks with overlap.

    Produces chunks of at most `chunk_chars` characters with `overlap` character overlap
    between adjacent chunks to preserve context at chunk boundaries.
    Returns at least one chunk even for short texts.
    """
    if len(text) <= chunk_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_chars
        chunks.append(text[start:end])
        start += chunk_chars - overlap
    return chunks


async def index_corpus(client: AsyncQdrantClient, corpus_dir: str) -> None:
    """Idempotently index all .md files in corpus_dir into Qdrant.

    Skips indexing if the collection already exists — safe to call on every startup.
    Uses fastembed for embedding (BAAI/bge-small-en-v1.5) so no external embedding
    service is required.
    """
    if await client.collection_exists(COLLECTION_NAME):
        logger.info("Collection '%s' already exists — skipping corpus indexing", COLLECTION_NAME)
        return

    logger.info("Indexing corpus from '%s' into collection '%s'", corpus_dir, COLLECTION_NAME)

    # Create collection using fastembed vector params (model already set by lifespan)
    await client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=client.get_fastembed_vector_params(),
    )

    corpus_path = Path(corpus_dir)
    documents: list[str] = []
    metadata: list[dict] = []

    for md_file in sorted(corpus_path.glob("*.md")):
        service_name = md_file.stem  # e.g., "kyc", "trading_engine"
        text = md_file.read_text(encoding="utf-8")
        chunks = _chunk_text(text)
        for chunk in chunks:
            documents.append(chunk)
            metadata.append(
                {
                    "service": service_name,
                    "source_file": md_file.name,
                }
            )
        logger.info("Loaded '%s': %d chunks", md_file.name, len(chunks))

    if not documents:
        logger.warning("No .md files found in '%s' — corpus is empty", corpus_dir)
        return

    await client.add(
        collection_name=COLLECTION_NAME,
        documents=documents,
        metadata=metadata,
    )
    logger.info(
        "Indexed %d chunks from %d corpus files into '%s'",
        len(documents),
        len(set(m["service"] for m in metadata)),
        COLLECTION_NAME,
    )
