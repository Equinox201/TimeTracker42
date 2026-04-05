import { endOfMonth, isBefore, startOfDay } from "date-fns";

export type GoalInputMode = "daily" | "weekly" | "monthly";
export type PaceMode = "calendar_days" | "weekdays";

export type GoalDraft = {
  dailyGoalHours: number;
  weeklyGoalHours: number;
  monthlyGoalHours: number;
  paceMode: PaceMode;
  daysPerWeek: number;
  effectiveFrom: Date;
};

function clampWhole(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function normalizeHours(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Number((Math.round(value * 3600) / 3600).toFixed(2));
}

function hoursToSeconds(value: number): number {
  return Math.max(0, Math.round(value * 3600));
}

function secondsToHours(value: number): number {
  return Number((value / 3600).toFixed(2));
}

export function countActiveDaysInMonth(monthAnchor: Date, paceMode: PaceMode): number {
  const monthStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const monthEnd = endOfMonth(monthStart);

  let cursor = monthStart;
  let count = 0;
  while (!isBefore(monthEnd, cursor)) {
    const isWeekday = cursor.getDay() !== 0 && cursor.getDay() !== 6;
    if (paceMode === "calendar_days" || isWeekday) {
      count += 1;
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return Math.max(count, 1);
}

export function deriveGoalDraft(params: {
  inputMode: GoalInputMode;
  inputGoalHours: number;
  paceMode: PaceMode;
  daysPerWeek: number;
  effectiveFrom: Date;
}): GoalDraft {
  const daysPerWeek = clampWhole(params.daysPerWeek, 1, 7);
  const activeDays = countActiveDaysInMonth(params.effectiveFrom, params.paceMode);
  const inputGoalSeconds = hoursToSeconds(params.inputGoalHours);

  let dailyGoalSeconds = 0;
  let weeklyGoalSeconds = 0;
  let monthlyGoalSeconds = 0;

  if (params.inputMode === "monthly") {
    monthlyGoalSeconds = inputGoalSeconds
    dailyGoalSeconds = Math.round(monthlyGoalSeconds / activeDays)
    weeklyGoalSeconds = Math.round(dailyGoalSeconds * daysPerWeek)
  } else if (params.inputMode === "weekly") {
    weeklyGoalSeconds = inputGoalSeconds
    dailyGoalSeconds = Math.round(weeklyGoalSeconds / daysPerWeek)
    monthlyGoalSeconds = Math.round(dailyGoalSeconds * activeDays)
  } else {
    dailyGoalSeconds = inputGoalSeconds
    weeklyGoalSeconds = Math.round(dailyGoalSeconds * daysPerWeek)
    monthlyGoalSeconds = Math.round(dailyGoalSeconds * activeDays)
  }

  return {
    dailyGoalHours: normalizeHours(secondsToHours(dailyGoalSeconds)),
    weeklyGoalHours: normalizeHours(secondsToHours(weeklyGoalSeconds)),
    monthlyGoalHours: normalizeHours(secondsToHours(monthlyGoalSeconds)),
    paceMode: params.paceMode,
    daysPerWeek,
    effectiveFrom: params.effectiveFrom
  };
}

export function countRemainingTargetDays(fromDate: Date, paceMode: PaceMode): number {
  const today = startOfDay(fromDate);
  const monthEnd = endOfMonth(today);

  let cursor = today;
  let count = 0;
  while (!isBefore(monthEnd, cursor)) {
    const isWeekday = cursor.getDay() !== 0 && cursor.getDay() !== 6;
    if (paceMode === "calendar_days" || isWeekday) {
      count += 1;
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return Math.max(count, 1);
}

export function buildRecommendedPace(params: {
  monthlyGoalHours: number;
  monthlyHoursSoFar: number;
  paceMode: PaceMode;
  daysPerWeek: number;
  fromDate: Date;
}) {
  const remainingHours = Math.max(params.monthlyGoalHours - params.monthlyHoursSoFar, 0);
  const targetDays = countRemainingTargetDays(params.fromDate, params.paceMode);
  const daysPerWeek = clampWhole(params.daysPerWeek, 1, 7);
  const recDaily = remainingHours / targetDays;
  const recWeekly = recDaily * daysPerWeek;

  return {
    targetDays,
    remainingHours: normalizeHours(remainingHours),
    recDaily: normalizeHours(recDaily),
    recWeekly: normalizeHours(recWeekly)
  };
}

export function formatGoalInput(value: number): string {
  const normalized = normalizeHours(value);
  return String(Number(normalized.toFixed(2)));
}
