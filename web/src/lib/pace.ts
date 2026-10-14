import {
  eachSingaporeDayKey,
  endOfSingaporeMonthKey,
  isSingaporeWeekdayKey,
  singaporeCalendarMonthDate
} from "./singaporeDate";

// "Am I ahead or behind?" for the monthly goal. Pure and deterministic: a function of the
// goal, hours so far, today (Singapore day key) and whether weekends count.
//
// Expected hours are linear over the days that count toward the goal: with a 110h goal and
// 22 weekdays, each weekday is worth 5h, and the weekend adds nothing.

export type PaceStatus = "ahead" | "on_pace" | "behind" | "done" | "no_goal";

export type PaceInput = {
  todayKey: string;
  monthlyGoalHours: number;
  hoursMonth: number;
  weekdaysOnly: boolean;
};

export type PaceResult = {
  status: PaceStatus;
  expectedHours: number;
  deltaHours: number; // positive = ahead
  targetDaysElapsed: number;
  targetDaysTotal: number;
  progressRatio: number;
  expectedRatio: number;
};

const MIN_TOLERANCE_HOURS = 0.5;
const TOLERANCE_SHARE_OF_GOAL = 0.02;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function targetDaysInMonth(monthKey: string, weekdaysOnly: boolean): string[] {
  const start = `${monthKey}-01`;
  const end = endOfSingaporeMonthKey(singaporeCalendarMonthDate(monthKey));
  return eachSingaporeDayKey(start, end).filter((day) => !weekdaysOnly || isSingaporeWeekdayKey(day));
}

export function expectedHoursThrough(
  dayKey: string,
  monthlyGoalHours: number,
  weekdaysOnly: boolean
): number {
  const days = targetDaysInMonth(dayKey.slice(0, 7), weekdaysOnly);
  if (days.length === 0 || monthlyGoalHours <= 0) {
    return 0;
  }
  const elapsed = days.filter((day) => day <= dayKey).length;
  return (monthlyGoalHours * elapsed) / days.length;
}

export function computePace(input: PaceInput): PaceResult {
  const days = targetDaysInMonth(input.todayKey.slice(0, 7), input.weekdaysOnly);
  const elapsed = days.filter((day) => day <= input.todayKey).length;
  const goal = Math.max(input.monthlyGoalHours, 0);

  if (goal === 0) {
    return {
      status: "no_goal",
      expectedHours: 0,
      deltaHours: 0,
      targetDaysElapsed: elapsed,
      targetDaysTotal: days.length,
      progressRatio: 0,
      expectedRatio: 0
    };
  }

  const expected = days.length > 0 ? (goal * elapsed) / days.length : 0;
  const delta = input.hoursMonth - expected;
  const tolerance = Math.max(MIN_TOLERANCE_HOURS, goal * TOLERANCE_SHARE_OF_GOAL);

  let status: PaceStatus;
  if (input.hoursMonth >= goal) {
    status = "done";
  } else if (delta > tolerance) {
    status = "ahead";
  } else if (delta < -tolerance) {
    status = "behind";
  } else {
    status = "on_pace";
  }

  return {
    status,
    expectedHours: round2(expected),
    deltaHours: round2(delta),
    targetDaysElapsed: elapsed,
    targetDaysTotal: days.length,
    progressRatio: input.hoursMonth / goal,
    expectedRatio: expected / goal
  };
}
