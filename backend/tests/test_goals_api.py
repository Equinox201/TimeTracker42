from datetime import date


def test_goals_default_and_upsert(client) -> None:
    get_default = client.get("/api/v1/goals/current", headers={"X-Demo-User": "alice"})

    assert get_default.status_code == 200
    assert get_default.json()["monthly_goal_seconds"] == 90 * 3600
    assert get_default.json()["pace_mode"] == "calendar_days"

    update_payload = {
        "daily_goal_seconds": 3 * 3600,
        "weekly_goal_seconds": 20 * 3600,
        "monthly_goal_seconds": 95 * 3600,
        "pace_mode": "weekdays",
        "effective_from": date.today().isoformat(),
    }

    updated = client.put(
        "/api/v1/goals/current",
        json=update_payload,
        headers={"X-Demo-User": "alice"},
    )
    assert updated.status_code == 200
    assert updated.json()["daily_goal_seconds"] == 3 * 3600
    assert updated.json()["monthly_goal_seconds"] == 95 * 3600
    assert updated.json()["pace_mode"] == "weekdays"

    fetched = client.get("/api/v1/goals/current", headers={"X-Demo-User": "alice"})
    assert fetched.status_code == 200
    assert fetched.json()["monthly_goal_seconds"] == 95 * 3600
