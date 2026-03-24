from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings


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
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
