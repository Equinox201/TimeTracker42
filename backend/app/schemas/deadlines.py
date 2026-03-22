from datetime import date

from pydantic import BaseModel, Field


class DeadlineCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    target_date: date
    target_hours: float = Field(gt=0)
    notes: str | None = None
