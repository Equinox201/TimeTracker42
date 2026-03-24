from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = monotonic()
        with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

            bucket.append(now)
            return RateLimitResult(allowed=True, retry_after_seconds=0)

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


rate_limiter = InMemoryRateLimiter()


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_rate_limit(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
    identity: str | None = None,
) -> None:
    suffix = identity or _client_ip(request)
    key = f"{bucket}:{suffix}"
    result = rate_limiter.check(key=key, limit=limit, window_seconds=window_seconds)
    if result.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded. Try again shortly.",
        headers={"Retry-After": str(result.retry_after_seconds)},
    )
