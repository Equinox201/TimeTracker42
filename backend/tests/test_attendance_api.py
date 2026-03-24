from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.models.attendance_daily import AttendanceDaily
from app.models.sync_run import AttendanceSyncRun


def test_attendance_history_returns_days_and_totals(client, db_session, make_auth_headers) -> None:
    headers, user = make_auth_headers(login="alice", forty_two_user_id=4242, display_name="Alice")

    today = date.today()
    yesterday = today - timedelta(days=1)

    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=yesterday,
            duration_seconds=3600,
            source_value_raw="01:00:00.000000",
        )
    )
    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=today,
            duration_seconds=1800,
            source_value_raw="00:30:00.000000",
        )
    )
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

    response = client.get(
        f"/api/v1/attendance/history?from={yesterday.isoformat()}&to={today.isoformat()}",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["from_date"] == yesterday.isoformat()
    assert payload["to_date"] == today.isoformat()
    assert payload["total_days"] == 2
    assert payload["total_hours"] == 1.5
    assert payload["is_stale"] is False
    assert payload["last_synced_at"] is not None
    assert len(payload["days"]) == 2
    assert payload["days"][0]["day"] == yesterday.isoformat()
    assert payload["days"][0]["hours"] == 1.0
    assert payload["days"][1]["day"] == today.isoformat()
    assert payload["days"][1]["hours"] == 0.5


def test_attendance_history_fills_missing_days(client, db_session, make_auth_headers) -> None:
    headers, user = make_auth_headers(login="bob", forty_two_user_id=4243, display_name="Bob")

    start = date.today() - timedelta(days=2)
    end = date.today()
    middle = start + timedelta(days=1)

    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=start,
            duration_seconds=7200,
            source_value_raw="02:00:00.000000",
            updated_from_source_at=datetime.now(UTC) - timedelta(hours=12),
        )
    )
    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=end,
            duration_seconds=3600,
            source_value_raw="01:00:00.000000",
            updated_from_source_at=datetime.now(UTC) - timedelta(hours=12),
        )
    )
    db_session.add(
        AttendanceSyncRun(
            user_id=user.id,
            trigger="manual",
            status="success",
            started_at=datetime.now(UTC) - timedelta(hours=12),
            finished_at=datetime.now(UTC) - timedelta(hours=12),
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/v1/attendance/history?from={start.isoformat()}&to={end.isoformat()}",
        headers=headers,
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["total_days"] == 3
    assert payload["total_hours"] == 3.0
    assert payload["is_stale"] is True
    assert payload["days"][1]["day"] == middle.isoformat()
    assert payload["days"][1]["has_record"] is False
    assert payload["days"][1]["duration_seconds"] is None
    assert payload["days"][1]["hours"] == 0.0


def test_attendance_history_rejects_invalid_date_range(client, make_auth_headers) -> None:
    headers, _ = make_auth_headers(login="carol", forty_two_user_id=4244, display_name="Carol")
    response = client.get(
        "/api/v1/attendance/history?from=2026-03-23&to=2026-03-01",
        headers=headers,
    )
    assert response.status_code == 400
    assert "from" in response.json()["detail"]
