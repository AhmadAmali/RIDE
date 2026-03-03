import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ride.db.session import Base


class SystemMapping(Base):
    __tablename__ = "system_mappings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    action_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("action_items.id"), nullable=False
    )
    system_name: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_by: Mapped[str] = mapped_column(String(50), nullable=False, default="rag")
    confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    engineer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    matched_chunk: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
