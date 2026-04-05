from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date

from app.models.goal import Goal

DEFAULT_MONTHLY_GOAL_SECONDS = 90 * 3600
DEFAULT_PACE_MODE = "calendar_days"
DEFAULT_DAYS_PER_WEEK = 5
PACE_MODES = {"calendar_days", "weekdays"}
INPUT_MODES = {"daily", "weekly", "monthly"}


@dataclass(frozen=True)
class ResolvedGoal:
    daily_goal_seconds: int
    weekly_goal_seconds: int
    monthly_goal_seconds: int
    pace_mode: str
    days_per_week: int
    effective_from: date


def month_active_days(month_anchor: date, pace_mode: str) -> int:
    _, days_in_month = monthrange(month_anchor.year, month_anchor.month)
    if pace_mode == "calendar_days":
        return max(days_in_month, 1)

    weekday_count = 0
    for day_number in range(1, days_in_month + 1):
        current = date(month_anchor.year, month_anchor.month, day_number)
        if current.weekday() < 5:
            weekday_count += 1

    return max(weekday_count, 1)


def validate_days_per_week(days_per_week: int) -> int:
    if not 1 <= days_per_week <= 7:
        raise ValueError("days_per_week must be between 1 and 7")
    return days_per_week


def validate_pace_mode(pace_mode: str) -> str:
    if pace_mode not in PACE_MODES:
        raise ValueError(f"pace_mode must be one of {sorted(PACE_MODES)}")
    return pace_mode


def derive_goal_from_input(
    *,
    input_mode: str,
    input_goal_seconds: int,
    pace_mode: str,
    days_per_week: int,
    effective_from: date,
) -> ResolvedGoal:
    if input_mode not in INPUT_MODES:
        raise ValueError(f"input_mode must be one of {sorted(INPUT_MODES)}")
    if input_goal_seconds < 0:
        raise ValueError("input_goal_seconds must be >= 0")

    normalized_days_per_week = validate_days_per_week(days_per_week)
    normalized_pace_mode = validate_pace_mode(pace_mode)
    active_days = month_active_days(effective_from, normalized_pace_mode)

    if input_mode == "monthly":
        monthly_goal_seconds = input_goal_seconds
        daily_goal_seconds = int(round(monthly_goal_seconds / active_days))
        weekly_goal_seconds = int(round(daily_goal_seconds * normalized_days_per_week))
    elif input_mode == "weekly":
        daily_goal_seconds = int(round(input_goal_seconds / normalized_days_per_week))
        weekly_goal_seconds = input_goal_seconds
        monthly_goal_seconds = int(round(daily_goal_seconds * active_days))
    else:
        daily_goal_seconds = input_goal_seconds
        weekly_goal_seconds = int(round(daily_goal_seconds * normalized_days_per_week))
        monthly_goal_seconds = int(round(daily_goal_seconds * active_days))

    return ResolvedGoal(
        daily_goal_seconds=max(daily_goal_seconds, 0),
        weekly_goal_seconds=max(weekly_goal_seconds, 0),
        monthly_goal_seconds=max(monthly_goal_seconds, 0),
        pace_mode=normalized_pace_mode,
        days_per_week=normalized_days_per_week,
        effective_from=effective_from,
    )


def default_goal(*, effective_from: date) -> ResolvedGoal:
    return derive_goal_from_input(
        input_mode="monthly",
        input_goal_seconds=DEFAULT_MONTHLY_GOAL_SECONDS,
        pace_mode=DEFAULT_PACE_MODE,
        days_per_week=DEFAULT_DAYS_PER_WEEK,
        effective_from=effective_from,
    )


def resolve_goal(goal: Goal | None, *, effective_from: date) -> ResolvedGoal:
    if goal is None:
        return default_goal(effective_from=effective_from)

    return ResolvedGoal(
        daily_goal_seconds=goal.daily_goal_seconds,
        weekly_goal_seconds=goal.weekly_goal_seconds,
        monthly_goal_seconds=goal.monthly_goal_seconds,
        pace_mode=validate_pace_mode(goal.pace_mode),
        days_per_week=validate_days_per_week(goal.days_per_week),
        effective_from=goal.effective_from,
    )
