import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import AsyncQdrantClient

from ride.api.routes.documents import router as documents_router
from ride.api.routes.obligations import router as obligations_router
from ride.api.routes.impact_matrix import router as impact_matrix_router
from ride.api.routes.system_mappings import action_items_router, router as system_mappings_router
from ride.config import settings
from ride.db.session import engine
from ride.kafka.producer import BaseProducer
from ride.rag.corpus_indexer import index_corpus
from ride.workers.action_item_worker import ActionItemWorker
from ride.workers.extract_worker import ExtractWorker
from ride.workers.parse_worker import ParseWorker
from ride.workers.rag_mapper_worker import RagMapperWorker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---

    # 1. Shared Kafka producer for API routes
    producer = BaseProducer()
    await producer.start()
    app.state.kafka_producer = producer

    # 2. Qdrant client — shared between corpus indexer and RAG mapper worker
    qdrant_client = AsyncQdrantClient(url=settings.qdrant_url)
    app.state.qdrant_client = qdrant_client

    # 3. Index corpus at startup (idempotent — skips if collection already exists)
    await index_corpus(qdrant_client, settings.corpus_dir)

    # 4. Parse worker: consumes DOCUMENT_UPLOADED, produces DOCUMENT_PARSED
    parse_worker = ParseWorker()
    await parse_worker.start()
    parse_task = asyncio.create_task(parse_worker.run())
    app.state.parse_worker = parse_worker
    app.state.parse_task = parse_task

    # 5. Extract worker: consumes DOCUMENT_PARSED, calls Claude, produces OBLIGATION_EXTRACTED
    extract_worker = ExtractWorker()
    await extract_worker.start()
    extract_task = asyncio.create_task(extract_worker.run())
    app.state.extract_worker = extract_worker
    app.state.extract_task = extract_task

    # 6. Action item worker: consumes OBLIGATION_APPROVED, calls Claude, produces ACTION_ITEM_GENERATED
    action_item_worker = ActionItemWorker()
    await action_item_worker.start()
    action_item_task = asyncio.create_task(action_item_worker.run())
    app.state.action_item_worker = action_item_worker
    app.state.action_item_task = action_item_task

    # 7. RAG mapper worker: consumes ACTION_ITEM_GENERATED, queries Qdrant, produces SYSTEM_MAPPING_PROPOSED
    rag_mapper_worker = RagMapperWorker(qdrant_client=qdrant_client)
    await rag_mapper_worker.start()
    rag_mapper_task = asyncio.create_task(rag_mapper_worker.run())
    app.state.rag_mapper_worker = rag_mapper_worker
    app.state.rag_mapper_task = rag_mapper_task

    yield

    # --- Shutdown (reverse order) ---
    rag_mapper_task.cancel()
    await rag_mapper_worker.stop()
    action_item_task.cancel()
    await action_item_worker.stop()
    extract_task.cancel()
    await extract_worker.stop()
    parse_task.cancel()
    await parse_worker.stop()
    await qdrant_client.close()
    await producer.stop()
    await engine.dispose()


app = FastAPI(
    lifespan=lifespan,
    title="RIDE API",
    version="0.1.0",
)

# CORS for Next.js frontend — add FIRST before other middleware
# Do NOT use allow_origins=["*"] with allow_credentials=True (browser rejects per CORS spec)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(documents_router)
app.include_router(obligations_router)
app.include_router(system_mappings_router)
app.include_router(action_items_router)
app.include_router(impact_matrix_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ride-api"}
