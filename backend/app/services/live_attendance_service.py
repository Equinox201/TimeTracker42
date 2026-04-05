from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.fortytwo_client import FortyTwoClient


@dataclass(frozen=True)
class LiveAttendanceOverlay:
    target_day: date
    live_seconds: int
    checked_at: datetime
    has_active_session: bool


def user_timezone(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def current_user_day(user: User, *, now_utc: datetime | None = None) -> date:
    current = _as_utc(now_utc or datetime.now(UTC))
    return current.astimezone(user_timezone(user)).date()


def build_live_today_overlay(
    db: Session,
    user: User,
    *,
    now_utc: datetime | None = None,
) -> LiveAttendanceOverlay:
    checked_at = _as_utc(now_utc or datetime.now(UTC))
    tz = user_timezone(user)
    local_now = checked_at.astimezone(tz)
    target_day = local_now.date()
    day_start_local = datetime.combine(target_day, time.min, tzinfo=tz)
    next_day_local = day_start_local + timedelta(days=1)

    raw_locations = FortyTwoClient.fetch_recent_locations(db, user)
    intervals: list[tuple[datetime, datetime]] = []
    has_active_session = False

    for row in raw_locations:
        begin_at = _parse_api_datetime(row.get("begin_at"))
        if begin_at is None:
            continue

        end_at = _parse_api_datetime(row.get("end_at"))
        if end_at is None:
            has_active_session = True

        start_local = begin_at.astimezone(tz)
        end_candidate = _as_utc(end_at or checked_at).astimezone(tz)
        clipped_end_local = min(end_candidate, local_now, next_day_local)
        clipped_start_local = max(start_local, day_start_local)

        if clipped_end_local <= clipped_start_local:
            continue

        intervals.append((clipped_start_local, clipped_end_local))

    merged = _merge_intervals(intervals)
    live_seconds = int(sum((end - start).total_seconds() for start, end in merged))

    return LiveAttendanceOverlay(
        target_day=target_day,
        live_seconds=max(live_seconds, 0),
        checked_at=checked_at,
        has_active_session=has_active_session,
    )


def _merge_intervals(
    intervals: list[tuple[datetime, datetime]],
) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []

    ordered = sorted(intervals, key=lambda value: value[0])
    merged: list[tuple[datetime, datetime]] = [ordered[0]]

    for start, end in ordered[1:]:
        previous_start, previous_end = merged[-1]
        if start <= previous_end:
            merged[-1] = (previous_start, max(previous_end, end))
        else:
            merged.append((start, end))

    return merged


def _parse_api_datetime(raw_value: Any) -> datetime | None:
    if raw_value is None:
        return None

    if not isinstance(raw_value, str):
        return None

    normalized = raw_value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return _as_utc(parsed)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
