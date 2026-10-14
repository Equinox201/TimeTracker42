import { eachSingaporeDayKey, endOfSingaporeMonthKey, singaporeCalendarMonthDate } from "./singaporeDate";
import { expectedHoursThrough } from "./pace";

export type CumulativePoint = {
  day: string;
  dayOfMonth: number;
  expected: number;
  actual: number | null; // null for days that have not happened yet
};

// Cumulative attended hours against the straight-line pace, one point per day of the month.
export function buildCumulativeSeries(params: {
  monthKey: string;
  todayKey: string;
  monthlyGoalHours: number;
  weekdaysOnly: boolean;
  hoursByDay: Record<string, number>;
}): CumulativePoint[] {
  const start = `${params.monthKey}-01`;
  const end = endOfSingaporeMonthKey(singaporeCalendarMonthDate(params.monthKey));

  let running = 0;
  return eachSingaporeDayKey(start, end).map((day) => {
    running += Math.max(params.hoursByDay[day] ?? 0, 0);
    const isFuture = day > params.todayKey;

    return {
      day,
      dayOfMonth: Number(day.slice(8, 10)),
      expected: Math.round(expectedHoursThrough(day, params.monthlyGoalHours, params.weekdaysOnly) * 100) / 100,
      actual: isFuture ? null : Math.round(running * 100) / 100
    };
  });
}
