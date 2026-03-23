from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from app.repositories.attendance_repository import (
    latest_source_update,
    list_attendance_between,
)
from app.schemas.attendance import AttendanceHistoryDay, AttendanceHistoryResponse

router = APIRouter()


def _hours(seconds: int | None) -> float:
    return round((seconds or 0) / 3600, 2)


@router.get("/history", response_model=AttendanceHistoryResponse)
def attendance_history(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceHistoryResponse:
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' must be less than or equal to 'to'",
        )

    if (to_date - from_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 367 days",
        )

    rows = list_attendance_between(
        db=db,
        user_id=current_user.id,
        from_date=from_date,
        to_date=to_date,
    )
    row_by_day = {row.day: row for row in rows}

    days: list[AttendanceHistoryDay] = []
    cursor = from_date
    total_seconds = 0
    while cursor <= to_date:
        row = row_by_day.get(cursor)
        duration_seconds = row.duration_seconds if row else None
        total_seconds += duration_seconds or 0

        days.append(
            AttendanceHistoryDay(
                day=cursor,
                duration_seconds=duration_seconds,
                hours=_hours(duration_seconds),
                source_value_raw=row.source_value_raw if row else None,
                has_record=row is not None,
            )
        )
        cursor += timedelta(days=1)

    latest_update = latest_source_update(db, current_user.id)
    stale_age_hours: float | None = None
    last_synced_at: datetime | None = None
    if latest_update is None:
        is_stale = True
    else:
        if latest_update.tzinfo is None:
            latest_update = latest_update.replace(tzinfo=UTC)
        stale_age_hours = round((datetime.now(UTC) - latest_update).total_seconds() / 3600, 2)
        is_stale = stale_age_hours > settings.stale_warning_hours
        last_synced_at = latest_update

    return AttendanceHistoryResponse(
        from_date=from_date,
        to_date=to_date,
        total_days=len(days),
        total_hours=_hours(total_seconds),
        is_stale=is_stale,
        stale_age_hours=stale_age_hours,
        last_synced_at=last_synced_at,
        days=days,
    )
