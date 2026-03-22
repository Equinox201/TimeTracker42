from pydantic import BaseModel


class DashboardSummary(BaseModel):
    hours_today: float
    hours_week: float
    hours_month: float
    monthly_goal_hours: float
    hours_left_to_monthly_goal: float
    required_hours_per_remaining_day: float
    required_hours_per_remaining_weekday: float
    is_stale: bool
