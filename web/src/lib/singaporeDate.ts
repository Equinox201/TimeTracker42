const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

function dayKeyFromUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calendarDateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// attendance_daily.day is keyed by the Singapore operational day, matching the sync Edge Function.
export function singaporeDayKey(value: Date = new Date()): string {
  return dayKeyFromUtcDate(new Date(value.getTime() + SINGAPORE_OFFSET_MS));
}

export function singaporeMonthKey(value: Date = new Date()): string {
  return singaporeDayKey(value).slice(0, 7);
}

export function dayKeyToSingaporeCalendarDate(value: string): Date {
  const parsed = calendarDateFromKey(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Number.NaN) : parsed;
}

export function singaporeCalendarMonthDate(monthKey: string): Date {
  return dayKeyToSingaporeCalendarDate(`${monthKey}-01`);
}

export function startOfSingaporeMonthKey(value: Date = new Date()): string {
  return `${singaporeMonthKey(value)}-01`;
}

export function endOfSingaporeMonthKey(value: Date = new Date()): string {
  const monthStart = dayKeyToSingaporeCalendarDate(startOfSingaporeMonthKey(value));
  if (Number.isNaN(monthStart.getTime())) {
    return singaporeDayKey(value);
  }
  return dayKeyFromUtcDate(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)));
}

export function startOfSingaporeWeekKey(value: Date = new Date()): string {
  const day = dayKeyToSingaporeCalendarDate(singaporeDayKey(value));
  const weekday = day.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + mondayOffset);
  return dayKeyFromUtcDate(day);
}

export function addSingaporeDaysKey(value: string, days: number): string {
  const date = dayKeyToSingaporeCalendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dayKeyFromUtcDate(date);
}

export function addSingaporeMonthsKey(monthKey: string, months: number): string {
  const date = singaporeCalendarMonthDate(monthKey);
  return dayKeyFromUtcDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))).slice(0, 7);
}

export function singaporeHistoryRangeKeys(monthsIncludingCurrent: number, value: Date = new Date()) {
  const currentMonth = singaporeMonthKey(value);
  const startMonth = addSingaporeMonthsKey(currentMonth, -(Math.max(monthsIncludingCurrent, 1) - 1));
  const start = `${startMonth}-01`;
  const end = endOfSingaporeMonthKey(value);
  return { start, end };
}

export function eachSingaporeMonthKey(fromDay: string, toDay: string): string[] {
  const startMonth = fromDay.slice(0, 7);
  const endMonth = toDay.slice(0, 7);
  const months: string[] = [];

  for (let cursor = startMonth; cursor <= endMonth; cursor = addSingaporeMonthsKey(cursor, 1)) {
    months.push(cursor);
  }

  return months;
}

export function singaporeWeekStartKeyFromDayKey(value: string): string {
  const day = dayKeyToSingaporeCalendarDate(value);
  if (Number.isNaN(day.getTime())) {
    return value;
  }
  const weekday = day.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + mondayOffset);
  return dayKeyFromUtcDate(day);
}

export function isSingaporeWeekdayKey(value: string): boolean {
  const date = dayKeyToSingaporeCalendarDate(value);
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function countSingaporeDaysInclusive(from: string, to: string): number {
  const start = dayKeyToSingaporeCalendarDate(from);
  const end = dayKeyToSingaporeCalendarDate(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function countRemainingSingaporeDays(from: string, to: string, weekdaysOnly: boolean): number {
  let count = 0;
  for (let cursor = from; cursor <= to; cursor = addSingaporeDaysKey(cursor, 1)) {
    if (!weekdaysOnly || isSingaporeWeekdayKey(cursor)) {
      count += 1;
    }
  }
  return Math.max(count, 1);
}

export function singaporeMonthLongLabel(monthKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(singaporeCalendarMonthDate(monthKey));
}

export function singaporeMonthShortLabel(monthKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    timeZone: "UTC"
  }).format(singaporeCalendarMonthDate(monthKey));
}

export function singaporeDayOfMonthLabel(dayKey: string): string {
  return String(Number(dayKey.slice(8, 10)));
}
