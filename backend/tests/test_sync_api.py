from __future__ import annotations

from datetime import date, timedelta

from app.core.security import now_utc
from app.models.attendance_daily import AttendanceDaily
from app.models.sync_run import AttendanceSyncRun
from app.services.fortytwo_client import FortyTwoClient, FortyTwoClientError


def test_manual_sync_inserts_and_then_hits_cooldown(
    client,
    db_session,
    monkeypatch,
    make_auth_headers,
) -> None:
    headers, user = make_auth_headers(login="alice", forty_two_user_id=4242, display_name="Alice")
    today = date.today()
    previous_day = today - timedelta(days=1)

    payloads = [
        {
            today.isoformat(): "01:30:00.000000",
            previous_day.isoformat(): None,
        },
        {
            today.isoformat(): "02:00:00.000000",
            previous_day.isoformat(): None,
        },
    ]

    def fake_fetch_locations_stats(_db, _user):
        return payloads.pop(0)

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    first = client.post("/api/v1/sync/manual", headers=headers)
    assert first.status_code == 200
    first_data = first.json()
    assert first_data["status"] == "success"
    assert first_data["inserted_days"] == 2
    assert first_data["updated_days"] == 0
    assert first_data["unchanged_days"] == 0

    second = client.post(
        "/api/v1/sync/manual",
        params={"force": "true"},
        headers=headers,
    )
    assert second.status_code == 429
    assert "cooldown" in second.json()["detail"].lower()

    today_row = (
        db_session.query(AttendanceDaily)
        .filter(AttendanceDaily.user_id == user.id, AttendanceDaily.day == today)
        .one()
    )
    assert today_row.duration_seconds == int(1.5 * 3600)
    assert today_row.source_value_raw == "01:30:00.000000"


def test_manual_sync_updates_existing_day_row(
    client,
    db_session,
    monkeypatch,
    make_auth_headers,
) -> None:
    headers, user = make_auth_headers(
        login="charlie",
        forty_two_user_id=4244,
        display_name="Charlie",
    )
    today = date.today()
    previous_day = today - timedelta(days=1)

    db_session.add(
        AttendanceDaily(
            user_id=user.id,
            day=today,
            duration_seconds=3600,
            source_value_raw="01:00:00.000000",
            updated_from_source_at=now_utc(),
        )
    )
    db_session.commit()

    def fake_fetch_locations_stats(_db, _user):
        return {
            today.isoformat(): "02:00:00.000000",
            previous_day.isoformat(): None,
        }

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    response = client.post("/api/v1/sync/manual", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["inserted_days"] == 1
    assert payload["updated_days"] == 1
    assert payload["unchanged_days"] == 0

    today_row = (
        db_session.query(AttendanceDaily)
        .filter(AttendanceDaily.user_id == user.id, AttendanceDaily.day == today)
        .one()
    )
    assert today_row.duration_seconds == 2 * 3600
    assert today_row.source_value_raw == "02:00:00.000000"


def test_manual_sync_respects_cooldown(client, db_session, monkeypatch, make_auth_headers) -> None:
    def fake_fetch_locations_stats(_db, _user):
        return {date.today().isoformat(): "01:00:00.000000"}

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    headers, user = make_auth_headers(login="bob", forty_two_user_id=4243, display_name="Bob")

    recent_run = AttendanceSyncRun(
        user_id=user.id,
        trigger="manual",
        status="success",
        started_at=now_utc(),
        finished_at=now_utc(),
    )
    db_session.add(recent_run)
    db_session.commit()

    response = client.post("/api/v1/sync/manual", headers=headers)
    assert response.status_code == 429
    assert "cooldown" in response.json()["detail"].lower()


def test_manual_sync_does_not_leak_upstream_error_details(
    client,
    monkeypatch,
    make_auth_headers,
) -> None:
    headers, _ = make_auth_headers(login="dana", forty_two_user_id=4245, display_name="Dana")

    def fake_fetch_locations_stats(_db, _user):
        raise FortyTwoClientError(
            "42 locations_stats request failed "
            "(status=403, user_identifier=dana, body={'error':'forbidden'})"
        )

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    response = client.post("/api/v1/sync/manual", headers=headers)
    assert response.status_code == 502

    detail = response.json()["detail"]
    assert detail == "Attendance sync failed. Please try again shortly."
    assert "user_identifier" not in detail
    assert "forbidden" not in detail
