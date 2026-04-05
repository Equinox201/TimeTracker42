from pydantic import BaseModel


class DashboardSummary(BaseModel):
    hours_today: float
    hours_today_finalized: float
    hours_today_live: float
    hours_week: float
    hours_month: float
    daily_goal_hours: float
    weekly_goal_hours: float
    monthly_goal_hours: float
    hours_left_to_monthly_goal: float
    required_hours_per_remaining_day: float
    required_hours_per_remaining_weekday: float
    week_vs_previous_week_hours: float
    month_vs_previous_month_hours: float
    pace_mode: str
    is_stale: bool
    stale_age_hours: float | None = None
    last_synced_at: str | None = None
    today_is_live: bool = False
    live_checked_at: str | None = None
