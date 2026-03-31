from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.core.security import create_oauth_state_token
from app.models.oauth_token import OAuthToken
from app.services.auth_service import AuthService


def test_auth_start_redirects_to_42_authorize_url(client) -> None:
    response = client.get(
        "/api/v1/auth/42/start",
        params={"mobile_redirect_uri": "timetracker42://auth/callback"},
        follow_redirects=False,
    )

    assert response.status_code == 302

    location = response.headers["location"]
    parsed = urlparse(location)
    query = parse_qs(parsed.query)

    assert parsed.geturl().startswith(settings.fortytwo_oauth_authorize_url)
    assert query["response_type"] == ["code"]
    assert query["client_id"] == [settings.fortytwo_client_id]
    assert "state" in query


def test_auth_start_rejects_unallowlisted_mobile_redirect(client) -> None:
    response = client.get(
        "/api/v1/auth/42/start",
        params={"mobile_redirect_uri": "https://evil.example/callback"},
        follow_redirects=False,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid mobile redirect URI"


def test_auth_start_accepts_allowlisted_web_redirect(client, monkeypatch) -> None:
    web_redirect = "https://timetracker42-web.example.com/auth/callback"
    monkeypatch.setattr(settings, "web_oauth_redirect_uris", web_redirect)

    response = client.get(
        "/api/v1/auth/42/start",
        params={"mobile_redirect_uri": web_redirect},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"].startswith(settings.fortytwo_oauth_authorize_url)


def test_auth_callback_rejects_unallowlisted_state_redirect(client) -> None:
    state = create_oauth_state_token(
        mobile_redirect_uri="https://evil.example/callback",
        secret=settings.jwt_secret,
        ttl_minutes=settings.oauth_state_ttl_minutes,
    )

    callback = client.get(
        "/api/v1/auth/42/callback",
        params={"code": "provider_code", "state": state},
        follow_redirects=False,
    )

    assert callback.status_code == 400
    assert callback.json()["detail"] == "Invalid mobile redirect URI"


def test_auth_callback_accepts_allowlisted_web_state_redirect(client, monkeypatch) -> None:
    web_redirect = "https://timetracker42-web.example.com/auth/callback"
    monkeypatch.setattr(settings, "web_oauth_redirect_uris", web_redirect)

    async def fake_exchange_code_for_token(code: str):
        assert code == "provider_code"

        return type(
            "TokenResponse",
            (),
            {
                "access_token": "provider_access",
                "refresh_token": "provider_refresh",
                "expires_in": 7200,
                "scope": "public",
            },
        )()

    async def fake_fetch_user_profile(access_token: str):
        assert access_token == "provider_access"

        return type(
            "Profile",
            (),
            {
                "id": 5555,
                "login": "webuser",
                "display_name": "Web User",
            },
        )()

    monkeypatch.setattr(AuthService, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(AuthService, "fetch_user_profile", fake_fetch_user_profile)

    state = create_oauth_state_token(
        mobile_redirect_uri=web_redirect,
        secret=settings.jwt_secret,
        ttl_minutes=settings.oauth_state_ttl_minutes,
    )

    callback = client.get(
        "/api/v1/auth/42/callback",
        params={"code": "provider_code", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 302
    assert callback.headers["location"].startswith(f"{web_redirect}?otc=")


def test_auth_callback_exchange_refresh_logout_flow(client, db_session, monkeypatch) -> None:
    async def fake_exchange_code_for_token(code: str):
        assert code == "provider_code"

        return type(
            "TokenResponse",
            (),
            {
                "access_token": "provider_access",
                "refresh_token": "provider_refresh",
                "expires_in": 7200,
                "scope": "public",
            },
        )()

    async def fake_fetch_user_profile(access_token: str):
        assert access_token == "provider_access"

        return type(
            "Profile",
            (),
            {
                "id": 4242,
                "login": "alice",
                "display_name": "Alice",
            },
        )()

    monkeypatch.setattr(AuthService, "exchange_code_for_token", fake_exchange_code_for_token)
    monkeypatch.setattr(AuthService, "fetch_user_profile", fake_fetch_user_profile)

    state = create_oauth_state_token(
        mobile_redirect_uri="timetracker42://auth/callback",
        secret=settings.jwt_secret,
        ttl_minutes=settings.oauth_state_ttl_minutes,
    )

    callback = client.get(
        "/api/v1/auth/42/callback",
        params={"code": "provider_code", "state": state},
        follow_redirects=False,
    )
    assert callback.status_code == 302

    callback_location = callback.headers["location"]
    parsed = urlparse(callback_location)
    query = parse_qs(parsed.query)
    one_time_code = query["otc"][0]
    assert one_time_code

    oauth_token_row = db_session.query(OAuthToken).filter_by(provider="42").one()
    assert oauth_token_row.access_token_encrypted != "provider_access"

    exchange = client.post(
        "/api/v1/auth/mobile/exchange",
        json={"one_time_code": one_time_code},
    )
    assert exchange.status_code == 200

    second_exchange = client.post(
        "/api/v1/auth/mobile/exchange",
        json={"one_time_code": one_time_code},
    )
    assert second_exchange.status_code == 401
    assert second_exchange.json()["detail"] == "One-time code already used"

    access_token = exchange.json()["access_token"]
    refresh_token = exchange.json()["refresh_token"]

    goals = client.get(
        "/api/v1/goals/current",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert goals.status_code == 200
    assert goals.json()["monthly_goal_seconds"] == 90 * 3600

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh.status_code == 200
    new_refresh_token = refresh.json()["refresh_token"]
    assert new_refresh_token != refresh_token

    old_refresh_again = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert old_refresh_again.status_code == 401

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh_token},
    )
    assert logout.status_code == 200

    refresh_after_logout = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh_token},
    )
    assert refresh_after_logout.status_code == 401
