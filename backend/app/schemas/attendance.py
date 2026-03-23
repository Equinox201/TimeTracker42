from datetime import date, datetime

from pydantic import BaseModel


class AttendanceHistoryDay(BaseModel):
    day: date
    duration_seconds: int | None
    hours: float
    source_value_raw: str | None
    has_record: bool


class AttendanceHistoryResponse(BaseModel):
    from_date: date
    to_date: date
    total_days: int
    total_hours: float
    is_stale: bool
    stale_age_hours: float | None
    last_synced_at: datetime | None
    days: list[AttendanceHistoryDay]
