from datetime import date, timedelta


def test_deadlines_crud(client) -> None:
    payload = {
        "title": "Piscine Deadline",
        "target_date": (date.today() + timedelta(days=10)).isoformat(),
        "target_hours": 18.5,
        "notes": "Focus on daily consistency",
    }

    created = client.post("/api/v1/deadlines", json=payload, headers={"X-Demo-User": "alice"})
    assert created.status_code == 201

    deadline_id = created.json()["id"]

    listed = client.get("/api/v1/deadlines", headers={"X-Demo-User": "alice"})
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["title"] == "Piscine Deadline"

    updated = client.put(
        f"/api/v1/deadlines/{deadline_id}",
        json={"is_completed": True, "target_hours": 20.0},
        headers={"X-Demo-User": "alice"},
    )
    assert updated.status_code == 200
    assert updated.json()["is_completed"] is True
    assert updated.json()["target_hours"] == 20.0

    deleted = client.delete(f"/api/v1/deadlines/{deadline_id}", headers={"X-Demo-User": "alice"})
    assert deleted.status_code == 204

    listed_after = client.get("/api/v1/deadlines", headers={"X-Demo-User": "alice"})
    assert listed_after.status_code == 200
    assert listed_after.json() == []
