from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goals import GoalResponse, GoalUpsertRequest
from app.services.goal_service import derive_goal_from_input, resolve_goal

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
        resolved = resolve_goal(goal, effective_from=date.today().replace(day=1))
        return GoalResponse(
            id=None,
            daily_goal_seconds=resolved.daily_goal_seconds,
            weekly_goal_seconds=resolved.weekly_goal_seconds,
            monthly_goal_seconds=resolved.monthly_goal_seconds,
            pace_mode=resolved.pace_mode,
            days_per_week=resolved.days_per_week,
            effective_from=resolved.effective_from,
            is_active=True,
        )

    return GoalResponse.model_validate(goal)


@router.put("/current", response_model=GoalResponse)
def upsert_goals(
    payload: GoalUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    if payload.input_mode is not None and payload.input_goal_seconds is not None:
        resolved = derive_goal_from_input(
            input_mode=payload.input_mode,
            input_goal_seconds=payload.input_goal_seconds,
            pace_mode=payload.pace_mode,
            days_per_week=payload.days_per_week,
            effective_from=payload.effective_from,
        )
    else:
        resolved = resolve_goal(
            Goal(
                daily_goal_seconds=payload.daily_goal_seconds or 0,
                weekly_goal_seconds=payload.weekly_goal_seconds or 0,
                monthly_goal_seconds=payload.monthly_goal_seconds or 0,
                pace_mode=payload.pace_mode,
                days_per_week=payload.days_per_week,
                effective_from=payload.effective_from,
                is_active=True,
                user_id=current_user.id,
            ),
            effective_from=payload.effective_from,
        )

    goal = db.scalar(
        select(Goal)
        .where(Goal.user_id == current_user.id, Goal.is_active.is_(True))
        .order_by(Goal.effective_from.desc())
    )

    if goal is None:
        goal = Goal(
            user_id=current_user.id,
            daily_goal_seconds=resolved.daily_goal_seconds,
            weekly_goal_seconds=resolved.weekly_goal_seconds,
            monthly_goal_seconds=resolved.monthly_goal_seconds,
            pace_mode=resolved.pace_mode,
            days_per_week=resolved.days_per_week,
            effective_from=resolved.effective_from,
            is_active=True,
        )
        db.add(goal)
    else:
        goal.daily_goal_seconds = resolved.daily_goal_seconds
        goal.weekly_goal_seconds = resolved.weekly_goal_seconds
        goal.monthly_goal_seconds = resolved.monthly_goal_seconds
        goal.pace_mode = resolved.pace_mode
        goal.days_per_week = resolved.days_per_week
        goal.effective_from = resolved.effective_from

    db.commit()
    db.refresh(goal)
    return GoalResponse.model_validate(goal)
