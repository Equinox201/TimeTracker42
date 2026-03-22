from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class MonthlyPace:
    remaining_seconds: int
    remaining_days: int
    required_seconds_per_day: float


def parse_duration_to_seconds(value: str | None) -> int | None:
    """Parse 42 API duration strings like '02:56:21.097917' into whole seconds."""
    if value is None:
        return None

    parts = value.split(":")
    if len(parts) != 3:
        raise ValueError(f"Invalid duration format: {value}")

    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])

    total_seconds = int(hours * 3600 + minutes * 60 + seconds)
    return total_seconds


def month_total_seconds(attendance_by_day: dict[date, int | None], today: date) -> int:
    return sum(
        seconds or 0
        for day, seconds in attendance_by_day.items()
        if day.year == today.year and day.month == today.month
    )


def count_remaining_days(today: date, weekdays_only: bool) -> int:
    _, days_in_month = monthrange(today.year, today.month)
    end_of_month = date(today.year, today.month, days_in_month)

    count = 0
    cursor = today
    while cursor <= end_of_month:
        if weekdays_only:
            if cursor.weekday() < 5:
                count += 1
        else:
            count += 1
        cursor += timedelta(days=1)

    return max(count, 1)


def calculate_monthly_pace(
    monthly_goal_seconds: int,
    attendance_by_day: dict[date, int | None],
    today: date,
    weekdays_only: bool,
) -> MonthlyPace:
    total = month_total_seconds(attendance_by_day, today)
    remaining_seconds = max(0, monthly_goal_seconds - total)
    remaining_days = count_remaining_days(today, weekdays_only)

    return MonthlyPace(
        remaining_seconds=remaining_seconds,
        remaining_days=remaining_days,
        required_seconds_per_day=remaining_seconds / remaining_days,
    )
