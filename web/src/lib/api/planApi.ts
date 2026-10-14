import { demoPlanRow, saveDemoPlan } from "../../demo/demoStore";
import { isDemoMode } from "../../demo/demoMode";
import { supabase } from "../supabase";

export type AttendancePlan = {
  month: string; // "YYYY-MM"
  weekdays: number[]; // ISO 1 (Mon) .. 7 (Sun)
  extraDays: string[];
  excludedDays: string[];
  maxHoursPerDay: number;
};

type PlanRow = {
  user_id: string;
  month: string;
  weekdays: number[];
  extra_days: string[];
  excluded_days: string[];
  max_hours_per_day: number;
};

const PLAN_FIELDS = "user_id,month,weekdays,extra_days,excluded_days,max_hours_per_day";

export function defaultPlan(month: string): AttendancePlan {
  return { month, weekdays: [1, 2, 3, 4, 5], extraDays: [], excludedDays: [], maxHoursPerDay: 8 };
}

function normalize(row: PlanRow): AttendancePlan {
  return {
    month: row.month,
    weekdays: [...row.weekdays].map(Number).sort((a, b) => a - b),
    extraDays: [...row.extra_days].sort(),
    excludedDays: [...row.excluded_days].sort(),
    maxHoursPerDay: Number(row.max_hours_per_day)
  };
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}

export async function getPlan(_accessToken: string, month: string): Promise<AttendancePlan> {
  if (isDemoMode()) {
    const row = demoPlanRow(month);
    return row ? normalize(row) : defaultPlan(month);
  }

  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from("attendance_plans")
    .select(PLAN_FIELDS)
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle<PlanRow>();

  if (error) {
    throw error;
  }

  return data ? normalize(data) : defaultPlan(month);
}

export async function savePlan(_accessToken: string, plan: AttendancePlan): Promise<AttendancePlan> {
  const patch = {
    weekdays: plan.weekdays,
    extra_days: plan.extraDays,
    excluded_days: plan.excludedDays,
    max_hours_per_day: plan.maxHoursPerDay
  };

  if (isDemoMode()) {
    return normalize(saveDemoPlan(plan.month, patch));
  }

  const userId = await authenticatedUserId();
  const { data, error } = await supabase
    .from("attendance_plans")
    .upsert({ user_id: userId, month: plan.month, ...patch, updated_at: new Date().toISOString() })
    .select(PLAN_FIELDS)
    .single<PlanRow>();

  if (error) {
    throw error;
  }

  return normalize(data);
}
