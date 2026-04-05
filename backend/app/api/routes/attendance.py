from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.sync_run import AttendanceSyncRun
from app.models.user import User
from app.repositories.attendance_repository import list_attendance_between
from app.schemas.attendance import AttendanceHistoryDay, AttendanceHistoryResponse
from app.services.live_attendance_service import build_live_today_overlay, current_user_day

router = APIRouter()


def _hours(seconds: int | None) -> float:
    return round((seconds or 0) / 3600, 2)


def _latest_successful_sync_finished_at(db: Session, user_id) -> datetime | None:
    return db.scalar(
        select(AttendanceSyncRun.finished_at)
        .where(
            AttendanceSyncRun.user_id == user_id,
            AttendanceSyncRun.status == "success",
            AttendanceSyncRun.finished_at.is_not(None),
        )
        .order_by(AttendanceSyncRun.finished_at.desc())
        .limit(1)
    )


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
    today = current_user_day(current_user)
    live_checked_at: datetime | None = None
    today_is_live = False

    if from_date <= today <= to_date:
        try:
            live_overlay = build_live_today_overlay(db, current_user)
            row = row_by_day.get(today)
            persisted_today_seconds = row.duration_seconds if row else 0
            if live_overlay.live_seconds > persisted_today_seconds:
                today_is_live = True
                live_checked_at = live_overlay.checked_at
                row_by_day[today] = type("OverlayRow", (), {
                    "day": today,
                    "duration_seconds": live_overlay.live_seconds,
                    "source_value_raw": row.source_value_raw if row else None,
                })()
        except Exception:
            pass

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

    latest_successful_sync = _latest_successful_sync_finished_at(db, current_user.id)
    stale_age_hours: float | None = None
    last_synced_at: datetime | None = None
    if latest_successful_sync is None:
        is_stale = True
    else:
        if latest_successful_sync.tzinfo is None:
            latest_successful_sync = latest_successful_sync.replace(tzinfo=UTC)
        stale_age_hours = round(
            (datetime.now(UTC) - latest_successful_sync).total_seconds() / 3600,
            2,
        )
        is_stale = stale_age_hours > settings.stale_warning_hours
        last_synced_at = latest_successful_sync

    return AttendanceHistoryResponse(
        from_date=from_date,
        to_date=to_date,
        total_days=len(days),
        total_hours=_hours(total_seconds),
        is_stale=is_stale,
        stale_age_hours=stale_age_hours,
        last_synced_at=last_synced_at,
        today_is_live=today_is_live,
        live_checked_at=live_checked_at,
        days=days,
    )
