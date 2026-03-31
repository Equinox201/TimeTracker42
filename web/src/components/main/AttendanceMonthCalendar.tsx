import { endOfMonth, format, getDay, startOfMonth, startOfWeek } from "date-fns";

import { type AttendanceHistoryDay } from "../../lib/api/dashboardApi";
import { hoursToReadable, monthYearLabel } from "../../lib/formatters";

type AttendanceMonthCalendarProps = {
  month: Date;
  dailyGoalHours: number;
  weeklyGoalHours: number;
  days: AttendanceHistoryDay[];
};

type DayState = "future" | "missed" | "achieved" | "exceeded";

type DayVisual = {
  background: string;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dayKey(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function shortHours(value: number): string {
  if (value <= 0) {
    return "0m";
  }
  if (value < 1) {
    return `${Math.round(value * 60)}m`;
  }
  return `${value.toFixed(1)}h`;
}

function visualForState(state: DayState, hours: number, dailyGoalHours: number): DayVisual {
  if (state === "future") {
    return { background: "rgba(120, 128, 145, 0.10)" };
  }

  if (state === "achieved") {
    return { background: "rgba(53, 224, 181, 0.30)" };
  }

  if (state === "exceeded") {
    if (dailyGoalHours <= 0) {
      return { background: "rgba(255, 15, 138, 0.34)" };
    }
    const ratio = clamp((hours - dailyGoalHours) / dailyGoalHours, 0, 1.6);
    const opacity = 0.34 + ratio * 0.16;
    return { background: `rgba(255, 15, 138, ${opacity.toFixed(3)})` };
  }

  if (dailyGoalHours <= 0) {
    return { background: "rgba(42, 50, 68, 0.20)" };
  }
  const missRatio = clamp((dailyGoalHours - hours) / dailyGoalHours, 0, 1);
  const opacity = 0.16 + missRatio * 0.18;
  return { background: `rgba(42, 50, 68, ${opacity.toFixed(3)})` };
}

function dayState(date: Date, hours: number, dailyGoalHours: number): DayState {
  const today = new Date();
  const todayKey = dayKey(today);
  const targetKey = dayKey(date);

  if (targetKey > todayKey) {
    return "future";
  }

  if (dailyGoalHours <= 0) {
    return hours > 0 ? "achieved" : "missed";
  }

  if (hours > dailyGoalHours) {
    return "exceeded";
  }
  if (hours >= dailyGoalHours) {
    return "achieved";
  }
  return "missed";
}

export function AttendanceMonthCalendar({ month, dailyGoalHours, weeklyGoalHours, days }: AttendanceMonthCalendarProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const byDate = new Map(days.map((day) => [day.day, day]));

  const weeklyTotals = new Map<string, number>();
  for (const day of days) {
    const date = new Date(`${day.day}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = dayKey(weekStart);
    weeklyTotals.set(key, (weeklyTotals.get(key) ?? 0) + day.hours);
  }

  const achievedWeekStarts = new Set<string>();
  if (weeklyGoalHours > 0) {
    for (const [weekStartKey, total] of weeklyTotals.entries()) {
      if (total >= weeklyGoalHours) {
        achievedWeekStarts.add(weekStartKey);
      }
    }
  }

  const dayDates: Array<Date | null> = [];
  const leadingPadding = (getDay(monthStart) + 6) % 7;
  for (let i = 0; i < leadingPadding; i += 1) {
    dayDates.push(null);
  }

  for (let cursor = new Date(monthStart); cursor <= monthEnd; cursor.setDate(cursor.getDate() + 1)) {
    dayDates.push(new Date(cursor));
  }

  while (dayDates.length % 7 !== 0) {
    dayDates.push(null);
  }

  return (
    <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Monthly Attendance Calendar</p>
          <h3 className="text-lg font-semibold text-tt42-text">{monthYearLabel(month)}</h3>
        </div>
        <p className="text-xs text-tt42-muted">Goal {hoursToReadable(dailyGoalHours)} / day</p>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-tt42-muted">
        {weekdayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {dayDates.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-14" />;
          }

          const iso = dayKey(date);
          const value = byDate.get(iso);
          const hours = value?.hours ?? 0;
          const state = dayState(date, hours, dailyGoalHours);
          const visual = visualForState(state, hours, dailyGoalHours);
          const today = dayKey(new Date()) === iso;
          const weekStart = dayKey(startOfWeek(date, { weekStartsOn: 1 }));
          const weekAchieved = achievedWeekStarts.has(weekStart);

          return (
            <div
              key={iso}
              className={[
                "flex h-14 flex-col items-center justify-center rounded-lg border border-transparent px-1 py-1",
                today ? "border-tt42-teal" : "",
                weekAchieved ? "ring-1 ring-tt42-mint/60" : ""
              ].join(" ")}
              style={{ backgroundColor: visual.background }}
            >
              <span className="text-xs font-semibold text-tt42-text">{format(date, "d")}</span>
              <span className="mt-0.5 text-[10px] text-tt42-muted">{shortHours(hours)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-tt42-muted sm:grid-cols-5">
        <LegendDot label="Exceeded" color="rgba(255, 15, 138, 0.42)" />
        <LegendDot label="Achieved" color="rgba(53, 224, 181, 0.30)" />
        <LegendDot label="Missed" color="rgba(42, 50, 68, 0.26)" />
        <LegendDot label="Future" color="rgba(120, 128, 145, 0.10)" />
        <LegendDot label="Week goal hit" color="rgba(53, 224, 181, 0.16)" withRing />
      </div>
    </article>
  );
}

function LegendDot({ label, color, withRing = false }: { label: string; color: string; withRing?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "inline-block h-3 w-4 rounded-sm",
          withRing ? "ring-1 ring-tt42-mint/70" : ""
        ].join(" ")}
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
