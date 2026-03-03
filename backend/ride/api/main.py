import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ride.api.routes.documents import router as documents_router
from ride.config import settings
from ride.db.session import engine
from ride.kafka.producer import BaseProducer
from ride.workers.parse_worker import ParseWorker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    # Shared Kafka producer for API routes
    producer = BaseProducer()
    await producer.start()
    app.state.kafka_producer = producer

    # Parse worker: consumes DOCUMENT_UPLOADED, produces DOCUMENT_PARSED
    parse_worker = ParseWorker()
    await parse_worker.start()
    parse_task = asyncio.create_task(parse_worker.run())
    app.state.parse_worker = parse_worker
    app.state.parse_task = parse_task

    # Extract worker will be added in Plan 02-02

    yield

    # --- Shutdown ---
    parse_task.cancel()
    await parse_worker.stop()
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ride-api"}
