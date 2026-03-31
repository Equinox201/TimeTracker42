import { authHeaders, requestJson } from "./http";

type GoalResponseWire = {
  id: string | null;
  daily_goal_seconds: number;
  weekly_goal_seconds: number;
  monthly_goal_seconds: number;
  pace_mode: "calendar_days" | "weekdays";
  effective_from: string;
  is_active: boolean;
};

type GoalUpsertWire = {
  daily_goal_seconds: number;
  weekly_goal_seconds: number;
  monthly_goal_seconds: number;
  pace_mode: "calendar_days" | "weekdays";
  effective_from: string;
};

type DeadlineWire = {
  id: string;
  title: string;
  target_date: string;
  target_hours: number;
  notes: string | null;
  is_completed: boolean;
};

type DeadlineCreateWire = {
  title: string;
  target_date: string;
  target_hours: number;
  notes: string | null;
};

type DeadlineUpdateWire = {
  title?: string;
  target_date?: string;
  target_hours?: number;
  notes?: string | null;
  is_completed?: boolean;
};

export type GoalSettings = {
  id: string | null;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  paceMode: "calendar_days" | "weekdays";
  effectiveFrom: string;
  isActive: boolean;
};

export type GoalUpsertInput = {
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  paceMode: "calendar_days" | "weekdays";
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

function normalizeGoal(payload: GoalResponseWire): GoalSettings {
  return {
    id: payload.id,
    dailyGoalHours: secondsToHours(payload.daily_goal_seconds),
    weeklyGoalHours: secondsToHours(payload.weekly_goal_seconds),
    monthlyGoalHours: secondsToHours(payload.monthly_goal_seconds),
    paceMode: payload.pace_mode,
    effectiveFrom: payload.effective_from,
    isActive: payload.is_active
  };
}

function normalizeDeadline(payload: DeadlineWire): Deadline {
  return {
    id: payload.id,
    title: payload.title,
    targetDate: payload.target_date,
    targetHours: payload.target_hours,
    notes: payload.notes,
    isCompleted: payload.is_completed
  };
}

export async function getCurrentGoals(accessToken: string): Promise<GoalSettings> {
  const payload = await requestJson<GoalResponseWire>("/api/v1/goals/current", {
    method: "GET",
    headers: authHeaders(accessToken)
  });
  return normalizeGoal(payload);
}

export async function upsertCurrentGoals(
  accessToken: string,
  payload: GoalUpsertInput
): Promise<GoalSettings> {
  const body: GoalUpsertWire = {
    daily_goal_seconds: hoursToSeconds(payload.dailyGoalHours),
    weekly_goal_seconds: hoursToSeconds(payload.weeklyGoalHours),
    monthly_goal_seconds: hoursToSeconds(payload.monthlyGoalHours),
    pace_mode: payload.paceMode,
    effective_from: payload.effectiveFrom
  };

  const response = await requestJson<GoalResponseWire>("/api/v1/goals/current", {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body)
  });

  return normalizeGoal(response);
}

export async function listDeadlines(accessToken: string): Promise<Deadline[]> {
  const payload = await requestJson<DeadlineWire[]>("/api/v1/deadlines", {
    method: "GET",
    headers: authHeaders(accessToken)
  });
  return payload.map(normalizeDeadline);
}

export async function createDeadline(
  accessToken: string,
  payload: DeadlineCreateInput
): Promise<Deadline> {
  const body: DeadlineCreateWire = {
    title: payload.title,
    target_date: payload.targetDate,
    target_hours: payload.targetHours,
    notes: payload.notes
  };

  const response = await requestJson<DeadlineWire>("/api/v1/deadlines", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body)
  });

  return normalizeDeadline(response);
}

export async function updateDeadline(
  accessToken: string,
  deadlineId: string,
  payload: DeadlineUpdateInput
): Promise<Deadline> {
  const body: DeadlineUpdateWire = {
    title: payload.title,
    target_date: payload.targetDate,
    target_hours: payload.targetHours,
    notes: payload.notes,
    is_completed: payload.isCompleted
  };

  const response = await requestJson<DeadlineWire>(`/api/v1/deadlines/${deadlineId}`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(body)
  });

  return normalizeDeadline(response);
}

export async function deleteDeadline(accessToken: string, deadlineId: string): Promise<void> {
  await requestJson<void>(`/api/v1/deadlines/${deadlineId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken)
  });
}
