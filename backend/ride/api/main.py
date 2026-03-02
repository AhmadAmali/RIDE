from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ride.config import settings
from ride.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup — nothing to initialize at this stage
    yield
    # shutdown
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ride-api"}
