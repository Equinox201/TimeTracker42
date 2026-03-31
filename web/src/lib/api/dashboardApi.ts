import { authHeaders, requestJson } from "./http";

type DashboardSummaryWire = {
  hours_today: number;
  hours_week: number;
  hours_month: number;
  daily_goal_hours: number;
  weekly_goal_hours: number;
  monthly_goal_hours: number;
  hours_left_to_monthly_goal: number;
  required_hours_per_remaining_day: number;
  required_hours_per_remaining_weekday: number;
  week_vs_previous_week_hours: number;
  month_vs_previous_month_hours: number;
  pace_mode: string;
  is_stale: boolean;
  stale_age_hours: number | null;
  last_synced_at: string | null;
};

type AttendanceHistoryDayWire = {
  day: string;
  duration_seconds: number | null;
  hours: number;
  source_value_raw: string | null;
  has_record: boolean;
};

type AttendanceHistoryWire = {
  from_date: string;
  to_date: string;
  total_days: number;
  total_hours: number;
  is_stale: boolean;
  stale_age_hours: number | null;
  last_synced_at: string | null;
  days: AttendanceHistoryDayWire[];
};

type ManualSyncResponseWire = {
  sync_run_id: string;
  status: string;
  inserted_days: number;
  updated_days: number;
  unchanged_days: number;
  started_at: string;
  finished_at: string;
};

export type DashboardSummary = {
  hoursToday: number;
  hoursWeek: number;
  hoursMonth: number;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  hoursLeftToMonthlyGoal: number;
  requiredHoursPerRemainingDay: number;
  requiredHoursPerRemainingWeekday: number;
  weekVsPreviousWeekHours: number;
  monthVsPreviousMonthHours: number;
  paceMode: string;
  isStale: boolean;
  staleAgeHours: number | null;
  lastSyncedAt: string | null;
};

export type AttendanceHistoryDay = {
  day: string;
  durationSeconds: number | null;
  hours: number;
  sourceValueRaw: string | null;
  hasRecord: boolean;
};

export type AttendanceHistory = {
  fromDate: string;
  toDate: string;
  totalDays: number;
  totalHours: number;
  isStale: boolean;
  staleAgeHours: number | null;
  lastSyncedAt: string | null;
  days: AttendanceHistoryDay[];
};

export type ManualSyncResponse = {
  syncRunId: string;
  status: string;
  insertedDays: number;
  updatedDays: number;
  unchangedDays: number;
  startedAt: string;
  finishedAt: string;
};

export type AttendanceRangeInput = {
  from: string;
  to: string;
};

function normalizeDashboard(payload: DashboardSummaryWire): DashboardSummary {
  return {
    hoursToday: payload.hours_today,
    hoursWeek: payload.hours_week,
    hoursMonth: payload.hours_month,
    dailyGoalHours: payload.daily_goal_hours,
    weeklyGoalHours: payload.weekly_goal_hours,
    monthlyGoalHours: payload.monthly_goal_hours,
    hoursLeftToMonthlyGoal: payload.hours_left_to_monthly_goal,
    requiredHoursPerRemainingDay: payload.required_hours_per_remaining_day,
    requiredHoursPerRemainingWeekday: payload.required_hours_per_remaining_weekday,
    weekVsPreviousWeekHours: payload.week_vs_previous_week_hours,
    monthVsPreviousMonthHours: payload.month_vs_previous_month_hours,
    paceMode: payload.pace_mode,
    isStale: payload.is_stale,
    staleAgeHours: payload.stale_age_hours,
    lastSyncedAt: payload.last_synced_at
  };
}

function normalizeHistory(payload: AttendanceHistoryWire): AttendanceHistory {
  return {
    fromDate: payload.from_date,
    toDate: payload.to_date,
    totalDays: payload.total_days,
    totalHours: payload.total_hours,
    isStale: payload.is_stale,
    staleAgeHours: payload.stale_age_hours,
    lastSyncedAt: payload.last_synced_at,
    days: payload.days.map((day) => ({
      day: day.day,
      durationSeconds: day.duration_seconds,
      hours: day.hours,
      sourceValueRaw: day.source_value_raw,
      hasRecord: day.has_record
    }))
  };
}

export async function getDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const payload = await requestJson<DashboardSummaryWire>("/api/v1/dashboard/summary", {
    method: "GET",
    headers: authHeaders(accessToken)
  });
  return normalizeDashboard(payload);
}

export async function getAttendanceHistory(
  accessToken: string,
  range: AttendanceRangeInput
): Promise<AttendanceHistory> {
  const query = new URLSearchParams({
    from: range.from,
    to: range.to
  });

  const payload = await requestJson<AttendanceHistoryWire>(`/api/v1/attendance/history?${query.toString()}`, {
    method: "GET",
    headers: authHeaders(accessToken)
  });

  return normalizeHistory(payload);
}

export async function triggerManualSync(accessToken: string): Promise<ManualSyncResponse> {
  const payload = await requestJson<ManualSyncResponseWire>("/api/v1/sync/manual", {
    method: "POST",
    headers: authHeaders(accessToken)
  });

  return {
    syncRunId: payload.sync_run_id,
    status: payload.status,
    insertedDays: payload.inserted_days,
    updatedDays: payload.updated_days,
    unchangedDays: payload.unchanged_days,
    startedAt: payload.started_at,
    finishedAt: payload.finished_at
  };
}
