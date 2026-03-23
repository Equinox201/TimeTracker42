from __future__ import annotations

from datetime import date, timedelta

from app.core.security import now_utc
from app.models.attendance_daily import AttendanceDaily
from app.models.sync_run import AttendanceSyncRun
from app.models.user import User
from app.services.fortytwo_client import FortyTwoClient


def test_manual_sync_inserts_then_updates(client, db_session, monkeypatch) -> None:
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

    first = client.post("/api/v1/sync/manual", headers={"X-Demo-User": "alice"})
    assert first.status_code == 200
    first_data = first.json()
    assert first_data["status"] == "success"
    assert first_data["inserted_days"] == 2
    assert first_data["updated_days"] == 0
    assert first_data["unchanged_days"] == 0

    second = client.post(
        "/api/v1/sync/manual",
        params={"force": "true"},
        headers={"X-Demo-User": "alice"},
    )
    assert second.status_code == 200
    second_data = second.json()
    assert second_data["status"] == "success"
    assert second_data["inserted_days"] == 0
    assert second_data["updated_days"] == 1
    assert second_data["unchanged_days"] == 1

    user = db_session.query(User).filter_by(login="alice").one()
    today_row = (
        db_session.query(AttendanceDaily)
        .filter(AttendanceDaily.user_id == user.id, AttendanceDaily.day == today)
        .one()
    )
    assert today_row.duration_seconds == 2 * 3600
    assert today_row.source_value_raw == "02:00:00.000000"


def test_manual_sync_respects_cooldown(client, db_session, monkeypatch) -> None:
    def fake_fetch_locations_stats(_db, _user):
        return {date.today().isoformat(): "01:00:00.000000"}

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    user = User(forty_two_user_id=4242, login="bob", display_name="Bob")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    recent_run = AttendanceSyncRun(
        user_id=user.id,
        trigger="manual",
        status="success",
        started_at=now_utc(),
        finished_at=now_utc(),
    )
    db_session.add(recent_run)
    db_session.commit()

    response = client.post("/api/v1/sync/manual", headers={"X-Demo-User": "bob"})
    assert response.status_code == 429
    assert "cooldown" in response.json()["detail"].lower()
