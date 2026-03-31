from __future__ import annotations

from datetime import date

import pytest

from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.services.fortytwo_client import FortyTwoClient


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    rate_limiter.reset()
    yield
    rate_limiter.reset()


def test_auth_start_rate_limited(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_auth_start_per_minute", 1)

    first = client.get(
        "/api/v1/auth/42/start",
        params={"mobile_redirect_uri": "timetracker42://auth/callback"},
        follow_redirects=False,
    )
    assert first.status_code == 302

    second = client.get(
        "/api/v1/auth/42/start",
        params={"mobile_redirect_uri": "timetracker42://auth/callback"},
        follow_redirects=False,
    )
    assert second.status_code == 429
    assert "rate limit" in second.json()["detail"].lower()
    assert "retry-after" in {k.lower() for k in second.headers.keys()}


def test_mobile_exchange_rate_limited_before_auth_validation(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "rate_limit_auth_exchange_per_minute", 1)

    first = client.post("/api/v1/auth/mobile/exchange", json={"one_time_code": "invalid-code-123"})
    assert first.status_code == 401

    second = client.post("/api/v1/auth/mobile/exchange", json={"one_time_code": "invalid-code-123"})
    assert second.status_code == 429
    assert "rate limit" in second.json()["detail"].lower()


def test_manual_sync_rate_limited_per_user(client, monkeypatch, make_auth_headers) -> None:
    headers, _ = make_auth_headers(
        login="ratelimit-user",
        forty_two_user_id=5001,
        display_name="Rate User",
    )
    monkeypatch.setattr(settings, "rate_limit_sync_manual_per_minute", 1)
    monkeypatch.setattr(settings, "sync_cooldown_minutes", 0)

    def fake_fetch_locations_stats(_db, _user):
        return {date.today().isoformat(): "01:00:00.000000"}

    monkeypatch.setattr(FortyTwoClient, "fetch_locations_stats", fake_fetch_locations_stats)

    first = client.post("/api/v1/sync/manual", headers=headers)
    assert first.status_code == 200

    second = client.post("/api/v1/sync/manual", headers=headers)
    assert second.status_code == 429
    assert "rate limit" in second.json()["detail"].lower()
