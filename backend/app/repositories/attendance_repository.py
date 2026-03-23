from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attendance_daily import AttendanceDaily


def list_attendance_between(
    db: Session,
    user_id: UUID,
    from_date: date,
    to_date: date,
) -> list[AttendanceDaily]:
    return db.scalars(
        select(AttendanceDaily)
        .where(
            AttendanceDaily.user_id == user_id,
            AttendanceDaily.day >= from_date,
            AttendanceDaily.day <= to_date,
        )
        .order_by(AttendanceDaily.day.asc())
    ).all()


def latest_source_update(
    db: Session,
    user_id: UUID,
):
    return db.scalar(
        select(func.max(AttendanceDaily.updated_from_source_at)).where(
            AttendanceDaily.user_id == user_id
        )
    )
