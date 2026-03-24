from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decrypt_text,
    encrypt_text,
    generate_secure_token,
    hash_refresh_token,
    now_utc,
)
from app.models.mobile_auth_code import MobileAuthCode
from app.models.oauth_token import OAuthToken
from app.models.refresh_token import AppRefreshToken
from app.models.user import User
from app.schemas.auth import FortyTwoProfile, FortyTwoTokenResponse, SessionUser, TokenPairResponse


class AuthFlowError(ValueError):
    pass


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class AuthService:
    provider_name = "42"

    @staticmethod
    def build_authorize_url(state_token: str) -> str:
        from urllib.parse import urlencode

        query = urlencode(
            {
                "client_id": settings.fortytwo_client_id,
                "redirect_uri": settings.fortytwo_redirect_uri,
                "response_type": "code",
                "scope": "public",
                "state": state_token,
            }
        )
        return f"{settings.fortytwo_oauth_authorize_url}?{query}"

    @staticmethod
    async def exchange_code_for_token(code: str) -> FortyTwoTokenResponse:
        payload = {
            "grant_type": "authorization_code",
            "client_id": settings.fortytwo_client_id,
            "client_secret": settings.fortytwo_client_secret,
            "code": code,
            "redirect_uri": settings.fortytwo_redirect_uri,
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(settings.fortytwo_oauth_token_url, data=payload)

        if response.status_code >= 400:
            raise AuthFlowError("Failed to exchange OAuth code")

        return FortyTwoTokenResponse.model_validate(response.json())

    @staticmethod
    async def fetch_user_profile(access_token: str) -> FortyTwoProfile:
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{settings.fortytwo_api_base_url}/me"

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code >= 400:
            raise AuthFlowError("Failed to fetch 42 profile")

        data: dict[str, Any] = response.json()
        display_name = data.get("usual_full_name") or data.get("displayname") or data.get("login")
        if not display_name:
            raise AuthFlowError("Invalid profile payload")

        normalized = {
            "id": int(data["id"]),
            "login": str(data["login"]),
            "display_name": str(display_name),
        }
        return FortyTwoProfile.model_validate(normalized)

    @staticmethod
    def upsert_user(db: Session, profile: FortyTwoProfile) -> User:
        user = db.scalar(select(User).where(User.forty_two_user_id == profile.id))

        if user is None:
            user = User(
                forty_two_user_id=profile.id,
                login=profile.login,
                display_name=profile.display_name,
            )
            db.add(user)
        else:
            user.login = profile.login
            user.display_name = profile.display_name
            user.updated_at = now_utc()

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def upsert_oauth_tokens(
        db: Session,
        user_id: UUID,
        token_response: FortyTwoTokenResponse,
    ) -> OAuthToken:
        oauth_token = db.scalar(
            select(OAuthToken).where(
                OAuthToken.user_id == user_id,
                OAuthToken.provider == AuthService.provider_name,
            )
        )

        expires_at = now_utc() + timedelta(seconds=token_response.expires_in)

        if oauth_token is None:
            oauth_token = OAuthToken(
                user_id=user_id,
                provider=AuthService.provider_name,
                access_token_encrypted=encrypt_text(
                    token_response.access_token,
                    settings.token_encryption_key,
                ),
                refresh_token_encrypted=encrypt_text(
                    token_response.refresh_token,
                    settings.token_encryption_key,
                )
                if token_response.refresh_token
                else None,
                expires_at=expires_at,
                scopes=token_response.scope,
            )
            db.add(oauth_token)
        else:
            oauth_token.access_token_encrypted = encrypt_text(
                token_response.access_token,
                settings.token_encryption_key,
            )
            oauth_token.refresh_token_encrypted = (
                encrypt_text(token_response.refresh_token, settings.token_encryption_key)
                if token_response.refresh_token
                else None
            )
            oauth_token.expires_at = expires_at
            oauth_token.scopes = token_response.scope
            oauth_token.updated_at = now_utc()

        db.commit()
        db.refresh(oauth_token)
        return oauth_token

    @staticmethod
    def get_provider_access_token(db: Session, user_id: UUID) -> str:
        oauth_token = db.scalar(
            select(OAuthToken).where(
                OAuthToken.user_id == user_id,
                OAuthToken.provider == AuthService.provider_name,
            )
        )
        if oauth_token is None:
            raise AuthFlowError("Missing provider token")

        return decrypt_text(oauth_token.access_token_encrypted, settings.token_encryption_key)

    @staticmethod
    def issue_mobile_auth_code(db: Session, user_id: UUID) -> str:
        raw_code = generate_secure_token(24)
        code_hash = hash_refresh_token(raw_code)
        expires_at = now_utc() + timedelta(minutes=settings.mobile_otc_ttl_minutes)

        code = MobileAuthCode(
            user_id=user_id,
            code_hash=code_hash,
            expires_at=expires_at,
        )
        db.add(code)
        db.commit()
        return raw_code

    @staticmethod
    def _build_token_pair(db: Session, user: User) -> TokenPairResponse:
        access_token, access_expires_at = create_access_token(
            user_id=user.id,
            secret=settings.jwt_secret,
            ttl_minutes=settings.jwt_access_ttl_minutes,
        )

        refresh_token = generate_secure_token(32)
        refresh_token_hash = hash_refresh_token(refresh_token)

        refresh_row = AppRefreshToken(
            user_id=user.id,
            token_hash=refresh_token_hash,
            expires_at=now_utc() + timedelta(days=settings.jwt_refresh_ttl_days),
        )
        db.add(refresh_row)
        db.commit()

        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires_at=access_expires_at,
            user=SessionUser.model_validate(user),
        )

    @staticmethod
    def consume_mobile_auth_code_and_issue_tokens(
        db: Session,
        one_time_code: str,
    ) -> TokenPairResponse:
        code_hash = hash_refresh_token(one_time_code)
        now = now_utc()

        claimed_user_id = db.scalar(
            update(MobileAuthCode)
            .where(
                MobileAuthCode.code_hash == code_hash,
                MobileAuthCode.used_at.is_(None),
                MobileAuthCode.expires_at > now,
            )
            .values(used_at=now)
            .returning(MobileAuthCode.user_id)
        )

        if claimed_user_id is None:
            code = db.scalar(select(MobileAuthCode).where(MobileAuthCode.code_hash == code_hash))
            if code is None:
                raise AuthFlowError("Invalid one-time code")
            if code.used_at is not None:
                raise AuthFlowError("One-time code already used")
            if _as_utc(code.expires_at) <= now:
                raise AuthFlowError("One-time code expired")
            raise AuthFlowError("Invalid one-time code")

        user = db.get(User, claimed_user_id)
        if user is None:
            db.rollback()
            raise AuthFlowError("Invalid one-time code user")

        try:
            return AuthService._build_token_pair(db, user)
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def rotate_refresh_token(db: Session, refresh_token: str) -> TokenPairResponse:
        token_hash = hash_refresh_token(refresh_token)
        refresh_row = db.scalar(
            select(AppRefreshToken).where(AppRefreshToken.token_hash == token_hash)
        )

        if refresh_row is None:
            raise AuthFlowError("Invalid refresh token")

        if refresh_row.revoked_at is not None:
            raise AuthFlowError("Refresh token revoked")

        if _as_utc(refresh_row.expires_at) <= now_utc():
            refresh_row.revoked_at = now_utc()
            db.commit()
            raise AuthFlowError("Refresh token expired")

        user = db.get(User, refresh_row.user_id)
        if user is None:
            raise AuthFlowError("Invalid refresh token user")

        refresh_row.revoked_at = now_utc()
        db.commit()

        return AuthService._build_token_pair(db, user)

    @staticmethod
    def revoke_refresh_token(db: Session, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        refresh_row = db.scalar(
            select(AppRefreshToken).where(AppRefreshToken.token_hash == token_hash)
        )

        if refresh_row is None:
            return

        if refresh_row.revoked_at is None:
            refresh_row.revoked_at = now_utc()
            db.commit()
