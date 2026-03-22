from datetime import date

from pydantic import BaseModel, Field


class GoalUpsertRequest(BaseModel):
    daily_goal_seconds: int = Field(ge=0)
    weekly_goal_seconds: int = Field(ge=0)
    monthly_goal_seconds: int = Field(ge=0)
    pace_mode: str = Field(pattern="^(calendar_days|weekdays)$")
    effective_from: date
