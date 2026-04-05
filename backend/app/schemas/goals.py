from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GoalUpsertRequest(BaseModel):
    input_mode: str | None = Field(default=None, pattern="^(daily|weekly|monthly)$")
    input_goal_seconds: int | None = Field(default=None, ge=0)
    daily_goal_seconds: int | None = Field(default=None, ge=0)
    weekly_goal_seconds: int | None = Field(default=None, ge=0)
    monthly_goal_seconds: int | None = Field(default=None, ge=0)
    pace_mode: str = Field(pattern="^(calendar_days|weekdays)$")
    days_per_week: int = Field(default=5, ge=1, le=7)
    effective_from: date

    @model_validator(mode="after")
    def validate_payload_shape(self) -> "GoalUpsertRequest":
        has_new_shape = self.input_mode is not None or self.input_goal_seconds is not None
        has_legacy_shape = any(
            value is not None
            for value in (
                self.daily_goal_seconds,
                self.weekly_goal_seconds,
                self.monthly_goal_seconds,
            )
        )

        if has_new_shape:
            if self.input_mode is None or self.input_goal_seconds is None:
                raise ValueError("input_mode and input_goal_seconds are required together")
            return self

        if not has_legacy_shape:
            raise ValueError(
                "Provide either input_mode/input_goal_seconds or legacy goal fields"
            )

        if self.daily_goal_seconds is None:
            raise ValueError("daily_goal_seconds is required for legacy payloads")
        if self.weekly_goal_seconds is None:
            raise ValueError("weekly_goal_seconds is required for legacy payloads")
        if self.monthly_goal_seconds is None:
            raise ValueError("monthly_goal_seconds is required for legacy payloads")

        return self


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID | None = None
    daily_goal_seconds: int
    weekly_goal_seconds: int
    monthly_goal_seconds: int
    pace_mode: str
    days_per_week: int
    effective_from: date
    is_active: bool
