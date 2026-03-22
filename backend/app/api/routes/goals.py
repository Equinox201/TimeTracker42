from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goals import GoalResponse, GoalUpsertRequest

router = APIRouter()


@router.get("/current", response_model=GoalResponse)
def get_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    goal = db.scalar(
        select(Goal)
        .where(Goal.user_id == current_user.id, Goal.is_active.is_(True))
        .order_by(Goal.effective_from.desc())
    )

    if goal is None:
        return GoalResponse(
            id=None,
            daily_goal_seconds=0,
            weekly_goal_seconds=0,
            monthly_goal_seconds=90 * 3600,
            pace_mode="calendar_days",
            effective_from=date.today(),
            is_active=True,
        )

    return GoalResponse.model_validate(goal)


@router.put("/current", response_model=GoalResponse)
def upsert_goals(
    payload: GoalUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    goal = db.scalar(
        select(Goal)
        .where(Goal.user_id == current_user.id, Goal.is_active.is_(True))
        .order_by(Goal.effective_from.desc())
    )

    if goal is None:
        goal = Goal(
            user_id=current_user.id,
            daily_goal_seconds=payload.daily_goal_seconds,
            weekly_goal_seconds=payload.weekly_goal_seconds,
            monthly_goal_seconds=payload.monthly_goal_seconds,
            pace_mode=payload.pace_mode,
            effective_from=payload.effective_from,
            is_active=True,
        )
        db.add(goal)
    else:
        goal.daily_goal_seconds = payload.daily_goal_seconds
        goal.weekly_goal_seconds = payload.weekly_goal_seconds
        goal.monthly_goal_seconds = payload.monthly_goal_seconds
        goal.pace_mode = payload.pace_mode
        goal.effective_from = payload.effective_from

    db.commit()
    db.refresh(goal)
    return GoalResponse.model_validate(goal)
