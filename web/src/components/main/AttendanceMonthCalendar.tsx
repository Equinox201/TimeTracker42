import { type AttendanceHistoryDay } from "../../lib/api/dashboardApi";
import { hoursToReadable } from "../../lib/formatters";
import {
  addSingaporeDaysKey,
  addSingaporeMonthsKey,
  dayKeyToSingaporeCalendarDate,
  singaporeDayKey,
  singaporeDayOfMonthLabel,
  singaporeMonthKey,
  singaporeMonthLongLabel,
  singaporeWeekStartKeyFromDayKey
} from "../../lib/singaporeDate";
import { Card } from "../../components/ui/Card";

type AttendanceMonthCalendarProps = {
  month: Date;
  monthKey?: string;
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

function shortHours(value: number): string {
  if (value <= 0) {
    return "0m";
  }
  if (value < 1) {
    return `${Math.round(value * 60)}m`;
  }
  return `${value.toFixed(1)}h`;
}

// One accent: intensity carries the meaning. Tints are mixed with transparent so they sit
// correctly on both the light and dark surface.
function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(percent)}%, transparent)`;
}

const ACCENT = "var(--tt42-accent)";
const NEUTRAL = "var(--tt42-text-muted)";

function visualForState(state: DayState, hours: number, dailyGoalHours: number): DayVisual {
  if (state === "future") {
    return { background: tint(NEUTRAL, 8) };
  }

  if (state === "achieved") {
    return { background: tint(ACCENT, 26) };
  }

  if (state === "exceeded") {
    if (dailyGoalHours <= 0) {
      return { background: tint(ACCENT, 40) };
    }
    const ratio = clamp((hours - dailyGoalHours) / dailyGoalHours, 0, 1.6);
    return { background: tint(ACCENT, 34 + ratio * 8) };
  }

  if (dailyGoalHours <= 0) {
    return { background: tint(NEUTRAL, 14) };
  }
  const missRatio = clamp((dailyGoalHours - hours) / dailyGoalHours, 0, 1);
  return { background: tint(NEUTRAL, 12 + missRatio * 14) };
}

function dayState(targetKey: string, hours: number, dailyGoalHours: number): DayState {
  const todayKey = singaporeDayKey();
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

export function AttendanceMonthCalendar({
  month,
  monthKey,
  dailyGoalHours,
  weeklyGoalHours,
  days
}: AttendanceMonthCalendarProps) {
  // attendance_daily.day is keyed by Asia/Singapore, so calendar cells are generated from Singapore day keys.
  const activeMonthKey = monthKey ?? singaporeMonthKey(month);
  const monthStartKey = `${activeMonthKey}-01`;
  const monthEndKey = addSingaporeDaysKey(`${addSingaporeMonthsKey(activeMonthKey, 1)}-01`, -1);

  const byDate = new Map(days.map((day) => [day.day, day]));

  const weeklyTotals = new Map<string, number>();
  for (const day of days) {
    if (Number.isNaN(dayKeyToSingaporeCalendarDate(day.day).getTime())) {
      continue;
    }
    const key = singaporeWeekStartKeyFromDayKey(day.day);
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

  const dayKeys: Array<string | null> = [];
  const monthStart = dayKeyToSingaporeCalendarDate(monthStartKey);
  const leadingPadding = (monthStart.getUTCDay() + 6) % 7;
  for (let i = 0; i < leadingPadding; i += 1) {
    dayKeys.push(null);
  }

  for (let cursor = monthStartKey; cursor <= monthEndKey; cursor = addSingaporeDaysKey(cursor, 1)) {
    dayKeys.push(cursor);
  }

  while (dayKeys.length % 7 !== 0) {
    dayKeys.push(null);
  }

  return (
    <Card padding="sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Monthly Attendance Calendar</p>
          <h3 className="text-lg font-semibold text-tt42-text">{singaporeMonthLongLabel(activeMonthKey)}</h3>
        </div>
        <p className="text-xs text-tt42-muted">Goal {hoursToReadable(dailyGoalHours)} / day</p>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-tt42-muted">
        {weekdayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {dayKeys.map((iso, index) => {
          if (!iso) {
            return <div key={`empty-${index}`} className="h-14" />;
          }

          const value = byDate.get(iso);
          const hours = value?.hours ?? 0;
          const state = dayState(iso, hours, dailyGoalHours);
          const visual = visualForState(state, hours, dailyGoalHours);
          const today = singaporeDayKey() === iso;
          const weekStart = singaporeWeekStartKeyFromDayKey(iso);
          const weekAchieved = achievedWeekStarts.has(weekStart);

          return (
            <div
              key={iso}
              className={[
                "flex h-14 flex-col items-center justify-center rounded-lg border border-transparent px-1 py-1",
                today ? "border-tt42-accent" : "",
                weekAchieved ? "ring-1 ring-tt42-accent/60" : ""
              ].join(" ")}
              style={{ backgroundColor: visual.background }}
            >
              <span className="text-xs font-semibold text-tt42-text">{singaporeDayOfMonthLabel(iso)}</span>
              <span className="mt-0.5 text-[11px] tabular-nums text-tt42-text">{shortHours(hours)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-tt42-muted sm:grid-cols-5">
        <LegendDot label="Exceeded" color={tint(ACCENT, 42)} />
        <LegendDot label="Achieved" color={tint(ACCENT, 26)} />
        <LegendDot label="Missed" color={tint(NEUTRAL, 22)} />
        <LegendDot label="Future" color={tint(NEUTRAL, 8)} />
        <LegendDot label="Week goal hit" color={tint(ACCENT, 12)} withRing />
      </div>
    </Card>
  );
}

function LegendDot({ label, color, withRing = false }: { label: string; color: string; withRing?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "inline-block h-3 w-4 rounded-sm",
          withRing ? "ring-1 ring-tt42-accent/70" : ""
        ].join(" ")}
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
