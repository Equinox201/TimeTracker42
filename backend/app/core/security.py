from __future__ import annotations

import hashlib
import secrets


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)
