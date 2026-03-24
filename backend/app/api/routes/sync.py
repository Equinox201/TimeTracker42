from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.sync import ManualSyncResponse
from app.services.sync_service import SyncError, can_run_manual_sync, sync_user_attendance

router = APIRouter()


@router.post("/manual", response_model=ManualSyncResponse)
def manual_sync(
    request: Request,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ManualSyncResponse:
    enforce_rate_limit(
        request,
        bucket="sync_manual",
        limit=settings.rate_limit_sync_manual_per_minute,
        window_seconds=60,
        identity=str(current_user.id),
    )

    # Force parameter is intentionally ignored to prevent public cooldown bypass.
    _ = force
    if not can_run_manual_sync(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Manual sync cooldown active. Try again in a few minutes.",
        )

    try:
        stats = sync_user_attendance(db, current_user, trigger="manual")
    except SyncError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return ManualSyncResponse(
        sync_run_id=stats.sync_run_id,
        status=stats.status,
        inserted_days=stats.inserted_days,
        updated_days=stats.updated_days,
        unchanged_days=stats.unchanged_days,
        started_at=stats.started_at,
        finished_at=stats.finished_at,
    )
