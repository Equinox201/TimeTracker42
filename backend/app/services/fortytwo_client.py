from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_text, encrypt_text, now_utc
from app.models.oauth_token import OAuthToken
from app.models.user import User
from app.schemas.auth import FortyTwoTokenResponse


class FortyTwoClientError(ValueError):
    pass


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class FortyTwoClient:
    provider_name = "42"

    @staticmethod
    def _get_oauth_row(db: Session, user_id: UUID) -> OAuthToken:
        oauth_row = db.scalar(
            select(OAuthToken).where(
                OAuthToken.user_id == user_id,
                OAuthToken.provider == FortyTwoClient.provider_name,
            )
        )
        if oauth_row is None:
            raise FortyTwoClientError("User has no stored 42 OAuth token")
        return oauth_row

    @staticmethod
    def _refresh_access_token(db: Session, oauth_row: OAuthToken) -> str:
        if not oauth_row.refresh_token_encrypted:
            raise FortyTwoClientError("Missing refresh token for 42 OAuth")

        refresh_token = decrypt_text(
            oauth_row.refresh_token_encrypted,
            settings.token_encryption_key,
        )

        payload = {
            "grant_type": "refresh_token",
            "client_id": settings.fortytwo_client_id,
            "client_secret": settings.fortytwo_client_secret,
            "refresh_token": refresh_token,
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(settings.fortytwo_oauth_token_url, data=payload)

        if response.status_code >= 400:
            raise FortyTwoClientError("Failed to refresh 42 access token")

        token_response = FortyTwoTokenResponse.model_validate(response.json())

        oauth_row.access_token_encrypted = encrypt_text(
            token_response.access_token,
            settings.token_encryption_key,
        )

        if token_response.refresh_token:
            oauth_row.refresh_token_encrypted = encrypt_text(
                token_response.refresh_token,
                settings.token_encryption_key,
            )

        oauth_row.expires_at = now_utc() + timedelta(seconds=token_response.expires_in)
        oauth_row.scopes = token_response.scope
        oauth_row.updated_at = now_utc()

        db.commit()
        db.refresh(oauth_row)

        return token_response.access_token

    @staticmethod
    def _get_valid_access_token(db: Session, user_id: UUID) -> str:
        oauth_row = FortyTwoClient._get_oauth_row(db, user_id)

        expires_at = oauth_row.expires_at
        if expires_at is None:
            return decrypt_text(oauth_row.access_token_encrypted, settings.token_encryption_key)

        if _as_utc(expires_at) > now_utc() + timedelta(minutes=1):
            return decrypt_text(oauth_row.access_token_encrypted, settings.token_encryption_key)

        return FortyTwoClient._refresh_access_token(db, oauth_row)

    @staticmethod
    def _get_app_access_token() -> str:
        payload = {
            "grant_type": "client_credentials",
            "client_id": settings.fortytwo_client_id,
            "client_secret": settings.fortytwo_client_secret,
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(settings.fortytwo_oauth_token_url, data=payload)

        if response.status_code >= 400:
            detail = response.text[:300]
            raise FortyTwoClientError(
                f"Failed to obtain app access token from 42 (status={response.status_code}, "
                f"body={detail})"
            )

        token_response = FortyTwoTokenResponse.model_validate(response.json())
        return token_response.access_token

    @staticmethod
    def _fetch_locations_stats_with_token(
        access_token: str,
        user_identifier: str,
    ) -> tuple[int, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{settings.fortytwo_api_base_url}/users/{user_identifier}/locations_stats"

        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=headers)

        payload: Any = None
        if response.content:
            try:
                payload = response.json()
            except ValueError:
                payload = response.text[:300]

        return response.status_code, payload

    @staticmethod
    def _fetch_recent_locations_with_token(
        access_token: str,
        user_identifier: str,
    ) -> tuple[int, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"page[size]": "100", "sort": "-begin_at"}
        url = f"{settings.fortytwo_api_base_url}/users/{user_identifier}/locations"

        with httpx.Client(timeout=20.0) as client:
            response = client.get(url, headers=headers, params=params)

        payload: Any = None
        if response.content:
            try:
                payload = response.json()
            except ValueError:
                payload = response.text[:300]

        return response.status_code, payload

    @staticmethod
    def fetch_locations_stats(db: Session, user: User) -> dict[str, str | None]:
        access_token = FortyTwoClient._get_valid_access_token(db, user.id)
        status_code, payload = FortyTwoClient._fetch_locations_stats_with_token(
            access_token=access_token,
            user_identifier=str(user.forty_two_user_id),
        )

        if status_code == 401:
            oauth_row = FortyTwoClient._get_oauth_row(db, user.id)
            access_token = FortyTwoClient._refresh_access_token(db, oauth_row)
            status_code, payload = FortyTwoClient._fetch_locations_stats_with_token(
                access_token=access_token,
                user_identifier=str(user.forty_two_user_id),
            )

        if status_code == 403:
            app_access_token = FortyTwoClient._get_app_access_token()
            status_code, payload = FortyTwoClient._fetch_locations_stats_with_token(
                access_token=app_access_token,
                user_identifier=user.login,
            )

        if status_code >= 400:
            raise FortyTwoClientError(
                "42 locations_stats request failed "
                f"(status={status_code}, user_identifier={user.login}, body={payload})"
            )

        if not isinstance(payload, dict):
            raise FortyTwoClientError("Invalid locations_stats payload format")

        normalized: dict[str, str | None] = {}
        for key, value in payload.items():
            day_key = str(key)
            if value is None:
                normalized[day_key] = None
            else:
                normalized[day_key] = str(value)

        return normalized

    @staticmethod
    def fetch_recent_locations(db: Session, user: User) -> list[dict[str, Any]]:
        access_token = FortyTwoClient._get_valid_access_token(db, user.id)
        status_code, payload = FortyTwoClient._fetch_recent_locations_with_token(
            access_token=access_token,
            user_identifier=str(user.forty_two_user_id),
        )

        if status_code == 401:
            oauth_row = FortyTwoClient._get_oauth_row(db, user.id)
            access_token = FortyTwoClient._refresh_access_token(db, oauth_row)
            status_code, payload = FortyTwoClient._fetch_recent_locations_with_token(
                access_token=access_token,
                user_identifier=str(user.forty_two_user_id),
            )

        if status_code == 403:
            app_access_token = FortyTwoClient._get_app_access_token()
            status_code, payload = FortyTwoClient._fetch_recent_locations_with_token(
                access_token=app_access_token,
                user_identifier=user.login,
            )

        if status_code >= 400:
            raise FortyTwoClientError(
                "42 locations request failed "
                f"(status={status_code}, user_identifier={user.login}, body={payload})"
            )

        if not isinstance(payload, list):
            raise FortyTwoClientError("Invalid locations payload format")

        normalized: list[dict[str, Any]] = []
        for item in payload:
            if isinstance(item, dict):
                normalized.append(item)

        return normalized
