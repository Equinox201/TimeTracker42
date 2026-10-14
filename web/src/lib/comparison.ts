import { addSingaporeDaysKey, addSingaporeMonthsKey, startOfSingaporeWeekKey } from "./singaporeDate";

// "vs last week / last month" must compare like with like: attendance so far this week or
// month against the same stretch of the previous one, not against its full total.

export type ComparisonRanges = {
  weekStart: string;
  previousWeekStart: string;
  previousWeekThroughSamePoint: string;
  monthStart: string;
  previousMonthStart: string;
  previousMonthThroughSamePoint: string;
};

export function comparisonRanges(todayKey: string): ComparisonRanges {
  const weekStart = startOfSingaporeWeekKey(new Date(`${todayKey}T00:00:00+08:00`));
  const previousWeekStart = addSingaporeDaysKey(weekStart, -7);
  const daysIntoWeek = Math.round(
    (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000
  );

  const monthKey = todayKey.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const previousMonthStart = `${addSingaporeMonthsKey(monthKey, -1)}-01`;
  const previousMonthEnd = addSingaporeDaysKey(monthStart, -1);
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const sameDayLastMonth = addSingaporeDaysKey(previousMonthStart, dayOfMonth - 1);

  return {
    weekStart,
    previousWeekStart,
    previousWeekThroughSamePoint: addSingaporeDaysKey(previousWeekStart, daysIntoWeek),
    monthStart,
    previousMonthStart,
    // A shorter previous month (e.g. 31 Mar vs February) ends at its own last day.
    previousMonthThroughSamePoint: sameDayLastMonth < previousMonthEnd ? sameDayLastMonth : previousMonthEnd
  };
}
