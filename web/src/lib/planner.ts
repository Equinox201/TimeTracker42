import {
  addSingaporeMonthsKey,
  eachSingaporeDayKey,
  endOfSingaporeMonthKey,
  singaporeCalendarMonthDate,
  singaporeIsoWeekday
} from "./singaporeDate";

// Attendance planner: given a monthly target, what has been attended, and which days the
// student can come in, is the target reachable, and what should each remaining day look like?
// Pure and deterministic; all dates are Singapore day keys ("YYYY-MM-DD").

export type PlannerInput = {
  todayKey: string;
  monthKey: string; // "YYYY-MM"
  targetSeconds: number;
  attendedByDay: Record<string, number>; // seconds, any days; only this month up to today is counted
  weekdays: number[]; // ISO 1 (Mon) .. 7 (Sun) the student attends
  extraDays: string[]; // additional specific days they can attend
  excludedDays: string[]; // days off (holidays, exams); always win
  maxSecondsPerDay: number;
};

export type PlannedDay = {
  day: string;
  seconds: number;
  capacitySeconds: number;
};

export type Suggestion =
  | { kind: "raise_cap"; maxSecondsPerDay: number }
  | { kind: "add_days"; days: string[] };

export type PlannerResult = {
  attendedSeconds: number;
  remainingSeconds: number;
  workableDays: string[];
  capacitySeconds: number;
  plannedDays: PlannedDay[];
  feasible: boolean;
  shortfallSeconds: number;
  requiredPerDaySeconds: number;
  suggestions: Suggestion[];
};

const MAX_SENSIBLE_CAP_SECONDS = 14 * 3600;
const SECONDS_PER_QUARTER_HOUR = 900;

function monthDays(monthKey: string): { start: string; end: string } {
  const start = `${monthKey}-01`;
  return { start, end: endOfSingaporeMonthKey(singaporeCalendarMonthDate(monthKey)) };
}

// Spreads `total` over days with the given capacities as evenly as the caps allow
// (water-filling): small caps are filled first, the rest share what is left equally.
export function distributeEvenly(capacities: number[], total: number): number[] {
  const order = capacities.map((cap, index) => ({ cap, index })).sort((a, b) => a.cap - b.cap);
  const allocation = new Array<number>(capacities.length).fill(0);
  let remaining = Math.max(total, 0);

  order.forEach((item, position) => {
    const share = remaining / (order.length - position);
    const amount = Math.min(item.cap, share);
    allocation[item.index] = amount;
    remaining -= amount;
  });

  return allocation;
}

export function buildPlan(input: PlannerInput): PlannerResult {
  const { start, end } = monthDays(input.monthKey);
  const excluded = new Set(input.excludedDays);
  const chosenWeekdays = new Set(input.weekdays);
  const extra = new Set(input.extraDays);
  const cap = Math.max(Math.round(input.maxSecondsPerDay), 0);

  const attendedSeconds = Object.entries(input.attendedByDay)
    .filter(([day]) => day >= start && day <= end && day <= input.todayKey)
    .reduce((sum, [, seconds]) => sum + Math.max(seconds, 0), 0);
  const remainingSeconds = Math.max(Math.round(input.targetSeconds) - attendedSeconds, 0);

  // Only days from today on can still be planned; today's capacity is what is left of the cap.
  const firstPlannable = input.todayKey > start ? input.todayKey : start;
  const futureDays = firstPlannable <= end ? eachSingaporeDayKey(firstPlannable, end) : [];
  const isWorkable = (day: string) =>
    !excluded.has(day) && (chosenWeekdays.has(singaporeIsoWeekday(day)) || extra.has(day));
  const capacityOn = (day: string) =>
    day === input.todayKey ? Math.max(cap - (input.attendedByDay[day] ?? 0), 0) : cap;

  const workableDays = futureDays.filter(isWorkable);
  const capacities = workableDays.map(capacityOn);
  const capacitySeconds = capacities.reduce((sum, value) => sum + value, 0);

  const base = {
    attendedSeconds,
    remainingSeconds,
    workableDays,
    capacitySeconds
  };

  if (remainingSeconds === 0) {
    return {
      ...base,
      plannedDays: workableDays.map((day) => ({ day, seconds: 0, capacitySeconds: capacityOn(day) })),
      feasible: true,
      shortfallSeconds: 0,
      requiredPerDaySeconds: 0,
      suggestions: []
    };
  }

  const feasible = capacitySeconds >= remainingSeconds;
  const allocation = feasible ? distributeEvenly(capacities, remainingSeconds) : capacities;
  const plannedDays = workableDays.map((day, index) => ({
    day,
    seconds: Math.round(allocation[index]),
    capacitySeconds: capacities[index]
  }));
  const shortfallSeconds = feasible ? 0 : remainingSeconds - capacitySeconds;
  const requiredPerDaySeconds =
    workableDays.length > 0 ? Math.ceil(remainingSeconds / workableDays.length) : remainingSeconds;

  return {
    ...base,
    plannedDays,
    feasible,
    shortfallSeconds,
    requiredPerDaySeconds,
    suggestions: feasible ? [] : buildSuggestions(input, base, futureDays, isWorkable, cap, remainingSeconds)
  };
}

function buildSuggestions(
  input: PlannerInput,
  base: { workableDays: string[]; capacitySeconds: number },
  futureDays: string[],
  isWorkable: (day: string) => boolean,
  cap: number,
  remainingSeconds: number
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const excluded = new Set(input.excludedDays);
  const todayAttended = input.attendedByDay[input.todayKey] ?? 0;
  const todayWorkable = base.workableDays.includes(input.todayKey);

  // 1. Same days, higher daily cap (today's capacity is the cap minus what is already attended).
  if (base.workableDays.length > 0) {
    const needed = (remainingSeconds + (todayWorkable ? todayAttended : 0)) / base.workableDays.length;
    const rounded = Math.ceil(needed / SECONDS_PER_QUARTER_HOUR) * SECONDS_PER_QUARTER_HOUR;
    if (rounded > cap && rounded <= MAX_SENSIBLE_CAP_SECONDS) {
      suggestions.push({ kind: "raise_cap", maxSecondsPerDay: rounded });
    }
  }

  // 2. Same cap, more days: weekdays before weekends, earliest first; days off are never suggested.
  const candidates = futureDays
    .filter((day) => !isWorkable(day) && !excluded.has(day))
    .sort((a, b) => {
      const aWeekend = singaporeIsoWeekday(a) >= 6 ? 1 : 0;
      const bWeekend = singaporeIsoWeekday(b) >= 6 ? 1 : 0;
      return aWeekend - bWeekend || a.localeCompare(b);
    });
  if (cap > 0 && candidates.length > 0) {
    const missing = remainingSeconds - base.capacitySeconds;
    const daysNeeded = Math.ceil(missing / cap);
    if (daysNeeded <= candidates.length) {
      suggestions.push({ kind: "add_days", days: candidates.slice(0, daysNeeded).sort() });
    }
  }

  return suggestions;
}

// First day of the month after `monthKey`, as a month key; used by the planner page's month switch.
export function nextMonthKey(monthKey: string): string {
  return addSingaporeMonthsKey(monthKey, 1);
}

export type DaySelection = {
  weekdays: number[];
  extraDays: string[];
  excludedDays: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

// What tapping a day on the planner calendar does:
//   a working day (weekday pattern, or an extra day) -> becomes a day off / is removed
//   a day off                                         -> works again
//   any other day                                     -> becomes an extra working day
// Returns the new extra and excluded lists; the weekday pattern is never touched.
export function toggleDay(
  selection: DaySelection,
  day: string
): Pick<DaySelection, "extraDays" | "excludedDays"> {
  const inPattern = selection.weekdays.includes(singaporeIsoWeekday(day));
  const isExcluded = selection.excludedDays.includes(day);
  const isExtra = selection.extraDays.includes(day);

  if (isExcluded) {
    return {
      excludedDays: selection.excludedDays.filter((value) => value !== day),
      extraDays: inPattern ? selection.extraDays : sortedUnique([...selection.extraDays, day])
    };
  }

  if (inPattern) {
    return {
      excludedDays: sortedUnique([...selection.excludedDays, day]),
      extraDays: selection.extraDays.filter((value) => value !== day)
    };
  }

  if (isExtra) {
    return {
      excludedDays: selection.excludedDays,
      extraDays: selection.extraDays.filter((value) => value !== day)
    };
  }

  return {
    excludedDays: selection.excludedDays,
    extraDays: sortedUnique([...selection.extraDays, day])
  };
}
