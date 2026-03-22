from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GoalUpsertRequest(BaseModel):
    daily_goal_seconds: int = Field(ge=0)
    weekly_goal_seconds: int = Field(ge=0)
    monthly_goal_seconds: int = Field(ge=0)
    pace_mode: str = Field(pattern="^(calendar_days|weekdays)$")
    effective_from: date


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID | None = None
    daily_goal_seconds: int
    weekly_goal_seconds: int
    monthly_goal_seconds: int
    pace_mode: str
    effective_from: date
    is_active: bool
