from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AttendanceDaily(Base):
    __tablename__ = "attendance_daily"
    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_attendance_daily_user_day"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_value_raw: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_from_source_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
