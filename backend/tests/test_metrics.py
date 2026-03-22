from datetime import date

from app.services.metrics import calculate_monthly_pace, parse_duration_to_seconds


def test_parse_duration_to_seconds() -> None:
    assert parse_duration_to_seconds("02:56:21.097917") == 10581
    assert parse_duration_to_seconds(None) is None


def test_calculate_monthly_pace_calendar_days() -> None:
    attendance = {
        date(2026, 3, 1): 7200,
        date(2026, 3, 2): 3600,
        date(2026, 3, 3): None,
    }
    pace = calculate_monthly_pace(
        monthly_goal_seconds=90 * 3600,
        attendance_by_day=attendance,
        today=date(2026, 3, 10),
        weekdays_only=False,
    )

    assert pace.remaining_seconds == 90 * 3600 - 10800
    assert pace.remaining_days > 0
    assert pace.required_seconds_per_day > 0
