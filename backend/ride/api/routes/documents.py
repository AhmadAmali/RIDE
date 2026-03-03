import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ride.config import settings
from ride.db.session import get_db
from ride.kafka.topics import KafkaTopic
from ride.models.document import Document

router = APIRouter(prefix="/api/documents", tags=["documents"])

_CHUNK_SIZE = 64 * 1024  # 64 KB


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),  # noqa: B008 — standard FastAPI form file pattern
    db: AsyncSession = Depends(get_db),  # noqa: B008 — standard FastAPI dependency pattern
) -> dict:
    """Upload a PDF document. Returns document_id and status 'uploaded'."""

    # --- Validate: PDF magic bytes ---
    header = await file.read(2048)
    if not header.startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="File must be a PDF")
    await file.seek(0)

    # --- Prepare destination ---
    os.makedirs(settings.upload_dir, exist_ok=True)
    doc_id = uuid.uuid4()
    upload_path = os.path.join(settings.upload_dir, f"{doc_id}.pdf")

    # --- Stream to disk with size guard (non-blocking) ---
    total_bytes = 0
    try:
        async with aiofiles.open(upload_path, "wb") as out_file:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > settings.max_upload_bytes:
                    # Delete the partial file before raising
                    await out_file.close()
                    if os.path.exists(upload_path):
                        os.remove(upload_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)}MB limit",
                    )
                await out_file.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        # Clean up partial file on unexpected error
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}") from exc

    # --- Persist Document record ---
    doc = Document(id=doc_id, filename=file.filename or "unknown.pdf", status="uploaded")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # --- Emit Kafka event ---
    await request.app.state.kafka_producer.send(
        KafkaTopic.DOCUMENT_UPLOADED,
        {"document_id": str(doc_id), "file_path": upload_path},
    )

    return {"document_id": str(doc_id), "status": "uploaded", "filename": file.filename}


@router.get("/")
async def list_documents(
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[dict]:
    """List all documents ordered by upload date (newest first)."""
    result = await db.execute(
        select(Document).order_by(Document.uploaded_at.desc())
    )
    documents = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "original_url": d.original_url,
            "content_markdown": d.content_markdown,
            "status": d.status,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in documents
    ]


@router.get("/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> dict:
    """Get a single document by ID."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "original_url": doc.original_url,
        "content_markdown": doc.content_markdown,
        "status": doc.status,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }
