from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeadlineCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    target_date: date
    target_hours: float = Field(gt=0)
    notes: str | None = None


class DeadlineUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    target_date: date | None = None
    target_hours: float | None = Field(default=None, gt=0)
    notes: str | None = None
    is_completed: bool | None = None


class DeadlineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    target_date: date
    target_hours: float
    notes: str | None
    is_completed: bool
