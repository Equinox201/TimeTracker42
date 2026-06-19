import { supabase } from "../supabase";
import { deriveGoalDraft } from "../goalMath";

type PaceMode = "calendar_days" | "weekdays";

type GoalRow = {
  user_id: string;
  daily_seconds: number;
  weekly_seconds: number;
  monthly_seconds: number;
  pace_mode: PaceMode;
  days_per_week: number;
  updated_at: string;
};

type DeadlineRow = {
  id: string;
  user_id: string;
  title: string;
  due_at: string;
  target_seconds: number | null;
  notes: string | null;
  is_completed: boolean;
};

export type GoalSettings = {
  id: string | null;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  paceMode: PaceMode;
  daysPerWeek: number;
  effectiveFrom: string;
  isActive: boolean;
};

export type GoalUpsertInput = {
  inputMode: "daily" | "weekly" | "monthly";
  inputGoalHours: number;
  paceMode: PaceMode;
  daysPerWeek: number;
  effectiveFrom: string;
};

export type Deadline = {
  id: string;
  title: string;
  targetDate: string;
  targetHours: number;
  notes: string | null;
  isCompleted: boolean;
};

export type DeadlineCreateInput = {
  title: string;
  targetDate: string;
  targetHours: number;
  notes: string | null;
};

export type DeadlineUpdateInput = {
  title?: string;
  targetDate?: string;
  targetHours?: number;
  notes?: string | null;
  isCompleted?: boolean;
};

function secondsToHours(value: number): number {
  return Number((value / 3600).toFixed(2));
}

function hoursToSeconds(value: number): number {
  return Math.max(0, Math.round(value * 3600));
}

function effectiveDateFromTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function dateOnlyToUtcMidnight(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function dateOnlyFromTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}

function normalizeGoal(row: GoalRow): GoalSettings {
  return {
    id: row.user_id,
    dailyGoalHours: secondsToHours(row.daily_seconds),
    weeklyGoalHours: secondsToHours(row.weekly_seconds),
    monthlyGoalHours: secondsToHours(row.monthly_seconds),
    paceMode: row.pace_mode,
    daysPerWeek: row.days_per_week,
    effectiveFrom: effectiveDateFromTimestamp(row.updated_at),
    isActive: true
  };
}

function normalizeDeadline(row: DeadlineRow): Deadline {
  return {
    id: row.id,
    title: row.title,
    targetDate: dateOnlyFromTimestamp(row.due_at),
    targetHours: secondsToHours(row.target_seconds ?? 0),
    notes: row.notes,
    isCompleted: row.is_completed
  };
}

async function createDefaultGoals(userId: string): Promise<GoalSettings> {
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId })
    .select("user_id,daily_seconds,weekly_seconds,monthly_seconds,pace_mode,days_per_week,updated_at")
    .single<GoalRow>();

  if (error) {
    throw error;
  }

  return normalizeGoal(data);
}

export async function getCurrentGoals(_accessToken: string): Promise<GoalSettings> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from("goals")
    .select("user_id,daily_seconds,weekly_seconds,monthly_seconds,pace_mode,days_per_week,updated_at")
    .eq("user_id", userId)
    .maybeSingle<GoalRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return createDefaultGoals(userId);
  }

  return normalizeGoal(data);
}

export async function updateCurrentGoals(
  _accessToken: string,
  payload: GoalUpsertInput
): Promise<GoalSettings> {
  const userId = await authenticatedUserId();
  const effectiveFrom = new Date(`${payload.effectiveFrom}T00:00:00`);
  const draft = deriveGoalDraft({
    inputMode: payload.inputMode,
    inputGoalHours: payload.inputGoalHours,
    paceMode: payload.paceMode,
    daysPerWeek: payload.daysPerWeek,
    effectiveFrom: Number.isNaN(effectiveFrom.getTime()) ? new Date() : effectiveFrom
  });

  const { data, error } = await supabase
    .from("goals")
    .upsert({
      user_id: userId,
      daily_seconds: hoursToSeconds(draft.dailyGoalHours),
      weekly_seconds: hoursToSeconds(draft.weeklyGoalHours),
      monthly_seconds: hoursToSeconds(draft.monthlyGoalHours),
      pace_mode: draft.paceMode,
      days_per_week: draft.daysPerWeek,
      updated_at: new Date().toISOString()
    })
    .select("user_id,daily_seconds,weekly_seconds,monthly_seconds,pace_mode,days_per_week,updated_at")
    .single<GoalRow>();

  if (error) {
    throw error;
  }

  return normalizeGoal(data);
}

export async function upsertCurrentGoals(
  accessToken: string,
  payload: GoalUpsertInput
): Promise<GoalSettings> {
  return updateCurrentGoals(accessToken, payload);
}

export async function getDeadlines(_accessToken: string): Promise<Deadline[]> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from("deadlines")
    .select("id,user_id,title,due_at,target_seconds,notes,is_completed")
    .eq("user_id", userId)
    .order("due_at", { ascending: true })
    .returns<DeadlineRow[]>();

  if (error) {
    throw error;
  }

  return data.map(normalizeDeadline);
}

export async function listDeadlines(accessToken: string): Promise<Deadline[]> {
  return getDeadlines(accessToken);
}

export async function createDeadline(
  _accessToken: string,
  payload: DeadlineCreateInput
): Promise<Deadline> {
  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from("deadlines")
    .insert({
      user_id: userId,
      title: payload.title,
      due_at: dateOnlyToUtcMidnight(payload.targetDate),
      target_seconds: hoursToSeconds(payload.targetHours),
      notes: payload.notes,
      is_completed: false
    })
    .select("id,user_id,title,due_at,target_seconds,notes,is_completed")
    .single<DeadlineRow>();

  if (error) {
    throw error;
  }

  return normalizeDeadline(data);
}

export async function updateDeadline(
  _accessToken: string,
  deadlineId: string,
  payload: DeadlineUpdateInput
): Promise<Deadline> {
  const userId = await authenticatedUserId();
  const body: Partial<DeadlineRow> = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.targetDate !== undefined ? { due_at: dateOnlyToUtcMidnight(payload.targetDate) } : {}),
    ...(payload.targetHours !== undefined ? { target_seconds: hoursToSeconds(payload.targetHours) } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.isCompleted !== undefined ? { is_completed: payload.isCompleted } : {})
  };

  const { data, error } = await supabase
    .from("deadlines")
    .update(body)
    .eq("id", deadlineId)
    .eq("user_id", userId)
    .select("id,user_id,title,due_at,target_seconds,notes,is_completed")
    .single<DeadlineRow>();

  if (error) {
    throw error;
  }

  return normalizeDeadline(data);
}

export async function deleteDeadline(_accessToken: string, deadlineId: string): Promise<void> {
  const userId = await authenticatedUserId();
  const { error } = await supabase
    .from("deadlines")
    .delete()
    .eq("id", deadlineId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
