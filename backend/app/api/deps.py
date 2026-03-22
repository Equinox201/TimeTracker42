from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import TokenError, decode_access_token
from app.models.user import User


def _create_demo_user(db: Session, login: str) -> User:
    max_id = db.scalar(select(func.max(User.forty_two_user_id))) or 0

    user = User(
        forty_two_user_id=max_id + 1,
        login=login,
        display_name=login,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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
    x_demo_user: str | None = Header(default=None, alias="X-Demo-User"),
) -> User:
    """Resolve current user.

    Priority:
    1) Bearer access token (real session path)
    2) X-Demo-User fallback (temporary pre-OAuth convenience)
    """
    if authorization is not None:
        return _resolve_from_bearer_token(db, authorization)

    if x_demo_user:
        user = db.scalar(select(User).where(User.login == x_demo_user))
        if user:
            return user
        return _create_demo_user(db, x_demo_user)

    existing_user = db.scalar(select(User).order_by(User.created_at.asc()))
    if existing_user:
        return existing_user

    return _create_demo_user(db, "demo")
