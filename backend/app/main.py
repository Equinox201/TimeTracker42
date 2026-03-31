from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


def _parse_allowed_origins(raw_value: str) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for raw in raw_value.split(","):
        origin = raw.strip().rstrip("/")
        if not origin:
            continue
        if origin in seen:
            continue
        seen.add(origin)
        values.append(origin)
    return values


def create_app() -> FastAPI:
    settings.validate_runtime_security()
    env = settings.app_env.strip().lower()
    docs_enabled = env in {"local", "test", "testing"}

    app = FastAPI(
        title="TimeTracker42 API",
        version="0.1.0",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
    )

    allowed_origins = _parse_allowed_origins(settings.web_allowed_origins)
    if allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
