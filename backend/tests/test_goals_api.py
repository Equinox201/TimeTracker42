from datetime import date


def test_goals_default_and_upsert(client, make_auth_headers) -> None:
    headers, _ = make_auth_headers(login="alice", forty_two_user_id=4242, display_name="Alice")
    get_default = client.get("/api/v1/goals/current", headers=headers)

    assert get_default.status_code == 200
    assert get_default.json()["monthly_goal_seconds"] == 90 * 3600
    assert get_default.json()["pace_mode"] == "calendar_days"
    assert get_default.json()["days_per_week"] == 5
    assert get_default.json()["daily_goal_seconds"] > 0
    assert get_default.json()["weekly_goal_seconds"] > 0

    update_payload = {
        "input_mode": "monthly",
        "input_goal_seconds": 95 * 3600,
        "pace_mode": "weekdays",
        "days_per_week": 4,
        "effective_from": date.today().isoformat(),
    }

    updated = client.put(
        "/api/v1/goals/current",
        json=update_payload,
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["monthly_goal_seconds"] == 95 * 3600
    assert updated.json()["pace_mode"] == "weekdays"
    assert updated.json()["days_per_week"] == 4
    assert updated.json()["daily_goal_seconds"] > 0
    assert updated.json()["weekly_goal_seconds"] > 0

    fetched = client.get("/api/v1/goals/current", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["monthly_goal_seconds"] == 95 * 3600
    assert fetched.json()["days_per_week"] == 4


def test_goals_accepts_legacy_payload_for_compatibility(
    client,
    make_auth_headers,
) -> None:
    headers, _ = make_auth_headers(login="bob", forty_two_user_id=4343, display_name="Bob")

    update_payload = {
        "daily_goal_seconds": 3 * 3600,
        "weekly_goal_seconds": 20 * 3600,
        "monthly_goal_seconds": 95 * 3600,
        "pace_mode": "weekdays",
        "days_per_week": 4,
        "effective_from": date.today().isoformat(),
    }

    updated = client.put("/api/v1/goals/current", json=update_payload, headers=headers)

    assert updated.status_code == 200
    assert updated.json()["daily_goal_seconds"] == 3 * 3600
    assert updated.json()["weekly_goal_seconds"] == 20 * 3600
    assert updated.json()["monthly_goal_seconds"] == 95 * 3600
    assert updated.json()["days_per_week"] == 4


def test_goals_derives_monthly_from_weekly_input(client, make_auth_headers) -> None:
    headers, _ = make_auth_headers(login="charlie", forty_two_user_id=4444, display_name="Charlie")

    payload = {
        "input_mode": "weekly",
        "input_goal_seconds": 18 * 3600,
        "pace_mode": "calendar_days",
        "days_per_week": 3,
        "effective_from": "2026-04-01",
    }

    response = client.put("/api/v1/goals/current", json=payload, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["weekly_goal_seconds"] == 18 * 3600
    assert body["daily_goal_seconds"] == 6 * 3600
    assert body["monthly_goal_seconds"] == 180 * 3600


def test_goals_rejects_invalid_days_per_week(client, make_auth_headers) -> None:
    headers, _ = make_auth_headers(login="dana", forty_two_user_id=4545, display_name="Dana")
    payload = {
        "input_mode": "daily",
        "input_goal_seconds": 3 * 3600,
        "pace_mode": "calendar_days",
        "days_per_week": 0,
        "effective_from": date.today().isoformat(),
    }

    response = client.put("/api/v1/goals/current", json=payload, headers=headers)
    assert response.status_code == 422


def test_goals_requires_authorization(client) -> None:
    response = client.get("/api/v1/goals/current")
    assert response.status_code == 401
