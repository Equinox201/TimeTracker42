from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

JWT_ALGORITHM = "HS256"


class TokenError(ValueError):
    pass


def now_utc() -> datetime:
    return datetime.now(UTC)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def _derived_fernet(secret: str) -> Fernet:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_text(plaintext: str, encryption_secret: str) -> str:
    fernet = _derived_fernet(encryption_secret)
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_text(ciphertext: str, encryption_secret: str) -> str:
    fernet = _derived_fernet(encryption_secret)
    try:
        decrypted = fernet.decrypt(ciphertext.encode("utf-8"))
    except InvalidToken as exc:  # pragma: no cover - defensive branch
        raise TokenError("Failed to decrypt token") from exc
    return decrypted.decode("utf-8")


def create_access_token(user_id: UUID, secret: str, ttl_minutes: int) -> tuple[str, datetime]:
    issued_at = now_utc()
    expires_at = issued_at + timedelta(minutes=ttl_minutes)

    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    encoded = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    return encoded, expires_at


def decode_access_token(token: str, secret: str) -> UUID:
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError("Invalid access token") from exc

    if payload.get("type") != "access":
        raise TokenError("Invalid token type")

    sub = payload.get("sub")
    if not sub:
        raise TokenError("Missing token subject")

    try:
        return UUID(sub)
    except ValueError as exc:
        raise TokenError("Invalid token subject") from exc


def create_oauth_state_token(
    mobile_redirect_uri: str,
    secret: str,
    ttl_minutes: int,
) -> str:
    issued_at = now_utc()
    expires_at = issued_at + timedelta(minutes=ttl_minutes)

    payload = {
        "type": "oauth_state",
        "mobile_redirect_uri": mobile_redirect_uri,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_oauth_state_token(state_token: str, secret: str) -> str:
    try:
        payload = jwt.decode(state_token, secret, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError("Invalid OAuth state") from exc

    if payload.get("type") != "oauth_state":
        raise TokenError("Invalid OAuth state type")

    mobile_redirect_uri = payload.get("mobile_redirect_uri")
    if not mobile_redirect_uri:
        raise TokenError("Missing OAuth redirect target")

    return str(mobile_redirect_uri)
