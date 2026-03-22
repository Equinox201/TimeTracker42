from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import (
    TokenError,
    create_oauth_state_token,
    decode_oauth_state_token,
)
from app.schemas.auth import LogoutRequest, MobileExchangeRequest, RefreshRequest, TokenPairResponse
from app.services.auth_service import AuthFlowError, AuthService

router = APIRouter()


def _append_query_param(url: str, key: str, value: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query[key] = value

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(query),
            parsed.fragment,
        )
    )


@router.get("/42/start")
def start_oauth(
    mobile_redirect_uri: str | None = Query(default=None),
) -> RedirectResponse:
    redirect_target = mobile_redirect_uri or f"{settings.mobile_deep_link_scheme}://auth/callback"

    state = create_oauth_state_token(
        mobile_redirect_uri=redirect_target,
        secret=settings.jwt_secret,
        ttl_minutes=settings.oauth_state_ttl_minutes,
    )

    authorize_url = AuthService.build_authorize_url(state)
    return RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)


@router.get("/42/callback")
async def oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth provider error: {error}",
        )

    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth code or state",
        )

    try:
        mobile_redirect_uri = decode_oauth_state_token(state, settings.jwt_secret)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        ) from exc

    try:
        provider_tokens = await AuthService.exchange_code_for_token(code)
        profile = await AuthService.fetch_user_profile(provider_tokens.access_token)
        user = AuthService.upsert_user(db, profile)
        AuthService.upsert_oauth_tokens(db, user.id, provider_tokens)
        one_time_code = AuthService.issue_mobile_auth_code(db, user.id)
    except AuthFlowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    redirect_url = _append_query_param(mobile_redirect_uri, "otc", one_time_code)
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.post("/mobile/exchange", response_model=TokenPairResponse)
def mobile_exchange(
    payload: MobileExchangeRequest,
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    try:
        return AuthService.consume_mobile_auth_code_and_issue_tokens(db, payload.one_time_code)
    except AuthFlowError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_session(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    try:
        return AuthService.rotate_refresh_token(db, payload.refresh_token)
    except AuthFlowError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    AuthService.revoke_refresh_token(db, payload.refresh_token)
    return {"status": "logged_out"}
