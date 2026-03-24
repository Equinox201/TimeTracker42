from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import TokenError, decode_access_token
from app.models.user import User


def _resolve_from_bearer_token(db: Session, authorization: str) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        user_id = decode_access_token(token, settings.jwt_secret)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token",
        )

    return user


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> User:
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )
    return _resolve_from_bearer_token(db, authorization)
