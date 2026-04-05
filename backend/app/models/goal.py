from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    daily_goal_seconds: Mapped[int] = mapped_column(Integer, default=0)
    weekly_goal_seconds: Mapped[int] = mapped_column(Integer, default=0)
    monthly_goal_seconds: Mapped[int] = mapped_column(Integer, default=90 * 60 * 60)
    pace_mode: Mapped[str] = mapped_column(String(32), default="calendar_days")
    days_per_week: Mapped[int] = mapped_column(Integer, default=5)
    effective_from: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
