import { supabase } from "../supabase";

type PaceMode = "calendar_days" | "weekdays";

type GoalRow = {
  user_id: string;
  daily_seconds: number;
  weekly_seconds: number;
  monthly_seconds: number;
  pace_mode: PaceMode;
  days_per_week: number;
};

type AttendanceDailyRow = {
  day: string;
  seconds: number;
  source: string;
  synced_at: string;
};

type SyncRunRow = {
  id: string;
  status: "success" | "failed" | "running";
  started_at: string;
  finished_at: string | null;
};

export type DashboardSummary = {
  hoursToday: number;
  hoursTodayFinalized: number;
  hoursTodayLive: number;
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
  todayIsLive: boolean;
  liveCheckedAt: string | null;
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
  todayIsLive: boolean;
  liveCheckedAt: string | null;
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

function secondsToHours(value: number): number {
  return Number((value / 3600).toFixed(2));
}

function hoursToSeconds(value: number): number {
  return Math.max(0, Math.round(value * 3600));
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function startOfUtcWeek(value: Date): Date {
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())), mondayOffset);
}

function isWeekday(value: Date): boolean {
  const day = value.getUTCDay();
  return day !== 0 && day !== 6;
}

function countDaysInclusive(from: string, to: string): number {
  const start = utcDate(from);
  const end = utcDate(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function countRemainingDays(from: Date, monthEnd: Date, weekdaysOnly: boolean): number {
  let count = 0;
  for (let cursor = from; cursor <= monthEnd; cursor = addDays(cursor, 1)) {
    if (!weekdaysOnly || isWeekday(cursor)) {
      count += 1;
    }
  }
  return Math.max(count, 1);
}

function sumSeconds(rows: AttendanceDailyRow[], from: string, to: string): number {
  return rows.reduce((sum, row) => {
    if (row.day >= from && row.day <= to) {
      return sum + row.seconds;
    }
    return sum;
  }, 0);
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}

async function getOrCreateGoals(userId: string): Promise<GoalRow> {
  const fields = "user_id,daily_seconds,weekly_seconds,monthly_seconds,pace_mode,days_per_week";
  const { data, error } = await supabase
    .from("goals")
    .select(fields)
    .eq("user_id", userId)
    .maybeSingle<GoalRow>();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("goals")
    .insert({ user_id: userId })
    .select(fields)
    .single<GoalRow>();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

async function listAttendance(userId: string, from: string, to: string): Promise<AttendanceDailyRow[]> {
  const { data, error } = await supabase
    .from("attendance_daily")
    .select("day,seconds,source,synced_at")
    .eq("user_id", userId)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true })
    .returns<AttendanceDailyRow[]>();

  if (error) {
    throw error;
  }

  return data;
}

async function latestSyncRun(userId: string): Promise<SyncRunRow | null> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("id,status,started_at,finished_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<SyncRunRow>();

  if (error) {
    throw error;
  }

  return data;
}

function syncMetadata(syncRun: SyncRunRow | null): Pick<DashboardSummary, "isStale" | "staleAgeHours" | "lastSyncedAt" | "todayIsLive" | "liveCheckedAt"> {
  const lastSyncedAt = syncRun?.finished_at ?? syncRun?.started_at ?? null;
  if (!lastSyncedAt) {
    return {
      isStale: true,
      staleAgeHours: null,
      lastSyncedAt: null,
      todayIsLive: false,
      liveCheckedAt: null
    };
  }

  const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
  const staleAgeHours = Number.isFinite(ageMs) ? Number((ageMs / 3_600_000).toFixed(1)) : null;
  return {
    isStale: staleAgeHours === null ? true : staleAgeHours >= 24,
    staleAgeHours,
    lastSyncedAt,
    todayIsLive: false,
    liveCheckedAt: null
  };
}

function mapHistoryDay(row: AttendanceDailyRow): AttendanceHistoryDay {
  return {
    day: row.day,
    durationSeconds: row.seconds,
    hours: secondsToHours(row.seconds),
    sourceValueRaw: String(row.seconds),
    hasRecord: row.seconds > 0
  };
}

export async function getDashboardSummary(_accessToken: string): Promise<DashboardSummary> {
  const userId = await authenticatedUserId();
  const goals = await getOrCreateGoals(userId);
  const today = new Date();
  const todayKey = dateKey(today);
  const monthStart = dateKey(startOfUtcMonth(today));
  const monthEndDate = endOfUtcMonth(today);
  const monthEnd = dateKey(monthEndDate);
  const weekStart = dateKey(startOfUtcWeek(today));
  const previousWeekStart = dateKey(addDays(utcDate(weekStart), -7));
  const previousWeekEnd = dateKey(addDays(utcDate(weekStart), -1));
  const previousMonthStartDate = startOfUtcMonth(addDays(startOfUtcMonth(today), -1));
  const previousMonthStart = dateKey(previousMonthStartDate);
  const previousMonthEnd = dateKey(endOfUtcMonth(previousMonthStartDate));

  const [attendanceRows, syncRun] = await Promise.all([
    listAttendance(userId, previousMonthStart, monthEnd),
    latestSyncRun(userId)
  ]);

  const todaySeconds = sumSeconds(attendanceRows, todayKey, todayKey);
  const weekSeconds = sumSeconds(attendanceRows, weekStart, todayKey);
  const monthSeconds = sumSeconds(attendanceRows, monthStart, todayKey);
  const previousWeekSeconds = sumSeconds(attendanceRows, previousWeekStart, previousWeekEnd);
  const previousMonthSeconds = sumSeconds(attendanceRows, previousMonthStart, previousMonthEnd);
  const hoursMonth = secondsToHours(monthSeconds);
  const monthlyGoalHours = secondsToHours(goals.monthly_seconds);
  const hoursLeftToMonthlyGoal = Math.max(monthlyGoalHours - hoursMonth, 0);
  const remainingCalendarDays = countRemainingDays(utcDate(todayKey), monthEndDate, false);
  const remainingWeekdays = countRemainingDays(utcDate(todayKey), monthEndDate, true);

  return {
    hoursToday: secondsToHours(todaySeconds),
    hoursTodayFinalized: secondsToHours(todaySeconds),
    hoursTodayLive: 0,
    hoursWeek: secondsToHours(weekSeconds),
    hoursMonth,
    dailyGoalHours: secondsToHours(goals.daily_seconds),
    weeklyGoalHours: secondsToHours(goals.weekly_seconds),
    monthlyGoalHours,
    hoursLeftToMonthlyGoal,
    requiredHoursPerRemainingDay: Number((hoursLeftToMonthlyGoal / remainingCalendarDays).toFixed(2)),
    requiredHoursPerRemainingWeekday: Number((hoursLeftToMonthlyGoal / remainingWeekdays).toFixed(2)),
    weekVsPreviousWeekHours: secondsToHours(weekSeconds - previousWeekSeconds),
    monthVsPreviousMonthHours: secondsToHours(monthSeconds - previousMonthSeconds),
    paceMode: goals.pace_mode,
    ...syncMetadata(syncRun)
  };
}

export async function getAttendanceHistory(
  _accessToken: string,
  range: AttendanceRangeInput
): Promise<AttendanceHistory> {
  const userId = await authenticatedUserId();
  const [attendanceRows, syncRun] = await Promise.all([
    listAttendance(userId, range.from, range.to),
    latestSyncRun(userId)
  ]);
  const days = attendanceRows.map(mapHistoryDay);
  const totalSeconds = attendanceRows.reduce((sum, row) => sum + row.seconds, 0);

  return {
    fromDate: range.from,
    toDate: range.to,
    totalDays: countDaysInclusive(range.from, range.to),
    totalHours: secondsToHours(totalSeconds),
    days,
    ...syncMetadata(syncRun)
  };
}

export async function triggerManualSync(_accessToken: string): Promise<ManualSyncResponse> {
  const now = new Date().toISOString();
  return {
    syncRunId: "not-implemented",
    status: "not_implemented",
    insertedDays: 0,
    updatedDays: 0,
    unchangedDays: 0,
    startedAt: now,
    finishedAt: now
  };
}
