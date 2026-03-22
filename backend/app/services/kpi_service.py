from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attendance_daily import AttendanceDaily
from app.models.goal import Goal
from app.schemas.dashboard import DashboardSummary
from app.services.metrics import calculate_monthly_pace


def _hours(seconds: int) -> float:
    return round(seconds / 3600, 2)


def _previous_month_range(current: date) -> tuple[date, date]:
    current_month_start = current.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)
    return previous_month_start, previous_month_end


def build_dashboard_summary(
    db: Session,
    user_id: UUID,
    stale_warning_hours: int,
    current_day: date | None = None,
) -> DashboardSummary:
    today = current_day or date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    previous_week_start = week_start - timedelta(days=7)
    previous_week_end = week_end - timedelta(days=7)

    previous_month_start, previous_month_end = _previous_month_range(today)

    query_start = min(previous_week_start, previous_month_start)

    rows = db.scalars(
        select(AttendanceDaily).where(
            AttendanceDaily.user_id == user_id,
            AttendanceDaily.day >= query_start,
            AttendanceDaily.day <= today,
        )
    ).all()

    attendance_by_day: dict[date, int] = {row.day: row.duration_seconds or 0 for row in rows}

    today_seconds = attendance_by_day.get(today, 0)

    week_seconds = sum(
        seconds
        for day, seconds in attendance_by_day.items()
        if week_start <= day <= week_end
    )

    previous_week_seconds = sum(
        seconds
        for day, seconds in attendance_by_day.items()
        if previous_week_start <= day <= previous_week_end
    )

    month_seconds = sum(
        seconds
        for day, seconds in attendance_by_day.items()
        if day.year == today.year and day.month == today.month
    )

    previous_month_seconds = sum(
        seconds
        for day, seconds in attendance_by_day.items()
        if previous_month_start <= day <= previous_month_end
    )

    goal = db.scalar(
        select(Goal)
        .where(Goal.user_id == user_id, Goal.is_active.is_(True))
        .order_by(Goal.effective_from.desc())
    )

    monthly_goal_seconds = goal.monthly_goal_seconds if goal else 90 * 3600
    pace_mode = goal.pace_mode if goal else "calendar_days"

    monthly_attendance = {
        day: seconds
        for day, seconds in attendance_by_day.items()
        if day.year == today.year and day.month == today.month
    }

    calendar_pace = calculate_monthly_pace(
        monthly_goal_seconds=monthly_goal_seconds,
        attendance_by_day=monthly_attendance,
        today=today,
        weekdays_only=False,
    )
    weekday_pace = calculate_monthly_pace(
        monthly_goal_seconds=monthly_goal_seconds,
        attendance_by_day=monthly_attendance,
        today=today,
        weekdays_only=True,
    )

    latest_source_update = db.scalar(
        select(func.max(AttendanceDaily.updated_from_source_at)).where(
            AttendanceDaily.user_id == user_id
        )
    )

    if latest_source_update is None:
        is_stale = True
    else:
        # Some DBs may return naive timestamps; treat them as UTC.
        if latest_source_update.tzinfo is None:
            latest_source_update = latest_source_update.replace(tzinfo=UTC)
        age_hours = (datetime.now(UTC) - latest_source_update).total_seconds() / 3600
        is_stale = age_hours > stale_warning_hours

    return DashboardSummary(
        hours_today=_hours(today_seconds),
        hours_week=_hours(week_seconds),
        hours_month=_hours(month_seconds),
        monthly_goal_hours=_hours(monthly_goal_seconds),
        hours_left_to_monthly_goal=_hours(max(0, monthly_goal_seconds - month_seconds)),
        required_hours_per_remaining_day=_hours(int(calendar_pace.required_seconds_per_day)),
        required_hours_per_remaining_weekday=_hours(int(weekday_pace.required_seconds_per_day)),
        week_vs_previous_week_hours=round(_hours(week_seconds - previous_week_seconds), 2),
        month_vs_previous_month_hours=round(_hours(month_seconds - previous_month_seconds), 2),
        pace_mode=pace_mode,
        is_stale=is_stale,
    )
