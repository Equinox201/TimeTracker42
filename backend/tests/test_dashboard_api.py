from datetime import UTC, date, datetime, timedelta

from app.models.attendance_daily import AttendanceDaily
from app.models.goal import Goal
from app.models.sync_run import AttendanceSyncRun


def test_dashboard_summary(client, db_session, make_auth_headers) -> None:
    headers, user = make_auth_headers(login="alice", forty_two_user_id=4242, display_name="Alice")

    goal = Goal(
        user_id=user.id,
        daily_goal_seconds=2 * 3600,
        weekly_goal_seconds=12 * 3600,
        monthly_goal_seconds=90 * 3600,
        pace_mode="calendar_days",
        effective_from=date.today().replace(day=1),
        is_active=True,
    )
    db_session.add(goal)

    today_row = AttendanceDaily(
        user_id=user.id,
        day=date.today(),
        duration_seconds=2 * 3600,
        source_value_raw="02:00:00.000000",
    )
    two_days_ago_row = AttendanceDaily(
        user_id=user.id,
        day=date.today() - timedelta(days=2),
        duration_seconds=1 * 3600,
        source_value_raw="01:00:00.000000",
    )

    db_session.add(today_row)
    db_session.add(two_days_ago_row)
    db_session.add(
        AttendanceSyncRun(
            user_id=user.id,
            trigger="manual",
            status="success",
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
        )
    )
    db_session.commit()

    response = client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["hours_today"] == 2.0
    assert data["hours_month"] >= 3.0
    assert data["daily_goal_hours"] == 2.0
    assert data["weekly_goal_hours"] == 12.0
    assert data["monthly_goal_hours"] == 90.0
    assert data["hours_left_to_monthly_goal"] <= 87.0
    assert data["pace_mode"] == "calendar_days"
    assert data["is_stale"] is False
    assert data["stale_age_hours"] is not None
    assert data["last_synced_at"] is not None
