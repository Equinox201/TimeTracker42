from fastapi import APIRouter

from app.api.routes import attendance, auth, dashboard, deadlines, goals, health, sync

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(goals.router, prefix="/goals", tags=["goals"])
api_router.include_router(deadlines.router, prefix="/deadlines", tags=["deadlines"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
