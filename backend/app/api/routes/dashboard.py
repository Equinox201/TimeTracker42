from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.kpi_service import build_dashboard_summary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    return build_dashboard_summary(
        db=db,
        user=current_user,
        stale_warning_hours=settings.stale_warning_hours,
    )
