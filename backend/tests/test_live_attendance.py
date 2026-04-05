from datetime import UTC, date, datetime, timedelta

from app.models.attendance_daily import AttendanceDaily
from app.models.sync_run import AttendanceSyncRun
from app.models.user import User
from app.services.live_attendance_service import build_live_today_overlay


def test_live_overlay_merges_overlaps_and_clips_day_bounds(monkeypatch, db_session) -> None:
    user = User(
        forty_two_user_id=9999,
        login="overlay",
        display_name="Overlay User",
        timezone="UTC",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    now_utc = datetime(2026, 4, 5, 12, 0, tzinfo=UTC)

    def fake_fetch_recent_locations(_db, _user):
        return [
            {
                "begin_at": "2026-04-04T23:30:00Z",
                "end_at": "2026-04-05T01:00:00Z",
            },
            {
                "begin_at": "2026-04-05T01:30:00Z",
                "end_at": "2026-04-05T03:00:00Z",
            },
            {
                "begin_at": "2026-04-05T02:30:00Z",
                "end_at": "2026-04-05T04:00:00Z",
            },
            {
                "begin_at": "2026-04-05T10:00:00Z",
                "end_at": None,
            },
        ]

    monkeypatch.setattr(
        "app.services.live_attendance_service.FortyTwoClient.fetch_recent_locations",
        fake_fetch_recent_locations,
    )

    overlay = build_live_today_overlay(db_session, user, now_utc=now_utc)

    assert overlay.target_day == date(2026, 4, 5)
    assert overlay.live_seconds == (3600 + 9000 + 7200)
    assert overlay.has_active_session is True
    assert overlay.checked_at == now_utc


def test_dashboard_summary_uses_live_overlay_when_greater(
    client,
    db_session,
    make_auth_headers,
    monkeypatch,
) -> None:
    headers, user = make_auth_headers(
        login="live-dashboard",
        forty_two_user_id=5000,
        display_name="Live Dashboard",
    )
    today = date.today()

    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=today,
            duration_seconds=2 * 3600,
            source_value_raw="02:00:00.000000",
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

    monkeypatch.setattr(
        "app.services.kpi_service.build_live_today_overlay",
        lambda _db, _user: type(
            "Overlay",
            (),
            {
                "target_day": today,
                "live_seconds": 5 * 3600,
                "checked_at": datetime(2026, 4, 5, 12, 0, tzinfo=UTC),
                "has_active_session": True,
            },
        )(),
    )

    response = client.get("/api/v1/dashboard/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["hours_today"] == 5.0
    assert body["hours_today_finalized"] == 2.0
    assert body["hours_today_live"] == 5.0
    assert body["today_is_live"] is True
    assert body["live_checked_at"] is not None


def test_dashboard_summary_falls_back_when_live_overlay_errors(
    client,
    db_session,
    make_auth_headers,
    monkeypatch,
) -> None:
    headers, user = make_auth_headers(
        login="live-fallback",
        forty_two_user_id=5001,
        display_name="Live Fallback",
    )
    today = date.today()

    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=today,
            duration_seconds=2 * 3600,
            source_value_raw="02:00:00.000000",
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

    def fail_overlay(_db, _user):
        raise RuntimeError("boom")

    monkeypatch.setattr("app.services.kpi_service.build_live_today_overlay", fail_overlay)

    response = client.get("/api/v1/dashboard/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["hours_today"] == 2.0
    assert body["hours_today_finalized"] == 2.0
    assert body["hours_today_live"] == 2.0
    assert body["today_is_live"] is False


def test_attendance_history_overlays_today_when_live_is_greater(
    client,
    db_session,
    make_auth_headers,
    monkeypatch,
) -> None:
    headers, user = make_auth_headers(
        login="live-history",
        forty_two_user_id=5002,
        display_name="Live History",
    )
    today = date.today()
    yesterday = today - timedelta(days=1)

    db_session.add_all(
        [
            AttendanceDaily(
                user_id=user.id,
                day=yesterday,
                duration_seconds=2 * 3600,
                source_value_raw="02:00:00.000000",
            ),
            AttendanceDaily(
                user_id=user.id,
                day=today,
                duration_seconds=1 * 3600,
                source_value_raw="01:00:00.000000",
            ),
        ]
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

    monkeypatch.setattr(
        "app.api.routes.attendance.build_live_today_overlay",
        lambda _db, _user: type(
            "Overlay",
            (),
            {
                "target_day": today,
                "live_seconds": 4 * 3600,
                "checked_at": datetime(2026, 4, 5, 12, 0, tzinfo=UTC),
                "has_active_session": True,
            },
        )(),
    )

    response = client.get(
        f"/api/v1/attendance/history?from={yesterday.isoformat()}&to={today.isoformat()}",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["today_is_live"] is True
    assert body["live_checked_at"] is not None
    assert body["total_hours"] == 6.0
    today_row = next(day for day in body["days"] if day["day"] == today.isoformat())
    assert today_row["hours"] == 4.0
    assert today_row["duration_seconds"] == 4 * 3600
