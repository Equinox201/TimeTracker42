from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), index=True)
    daily_goal_seconds: Mapped[int] = mapped_column(Integer, default=0)
    weekly_goal_seconds: Mapped[int] = mapped_column(Integer, default=0)
    monthly_goal_seconds: Mapped[int] = mapped_column(Integer, default=90 * 60 * 60)
    pace_mode: Mapped[str] = mapped_column(String(32), default="calendar_days")
    effective_from: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
