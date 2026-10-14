import { hoursToCompact } from "../../lib/formatters";
import {
  addSingaporeDaysKey,
  addSingaporeMonthsKey,
  dayKeyToSingaporeCalendarDate,
  singaporeDayOfMonthLabel,
  singaporeIsoWeekday
} from "../../lib/singaporeDate";

type PlanCalendarProps = {
  monthKey: string;
  todayKey: string;
  weekdays: number[];
  extraDays: string[];
  excludedDays: string[];
  plannedSecondsByDay: Record<string, number>;
  attendedSecondsByDay: Record<string, number>;
  onToggleDay: (day: string) => void;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CellState = "past" | "off" | "work" | "extra" | "rest";

// A month grid where tapping a day toggles it: working day -> day off, day off -> working,
// any other day -> an extra working day. Planned hours are shown on each working day.
export function PlanCalendar({
  monthKey,
  todayKey,
  weekdays,
  extraDays,
  excludedDays,
  plannedSecondsByDay,
  attendedSecondsByDay,
  onToggleDay
}: PlanCalendarProps) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = addSingaporeDaysKey(`${addSingaporeMonthsKey(monthKey, 1)}-01`, -1);
  const excluded = new Set(excludedDays);
  const extra = new Set(extraDays);
  const pattern = new Set(weekdays);

  const cells: Array<string | null> = [];
  const leading = (dayKeyToSingaporeCalendarDate(monthStart).getUTCDay() + 6) % 7;
  for (let index = 0; index < leading; index += 1) {
    cells.push(null);
  }
  for (let day = monthStart; day <= monthEnd; day = addSingaporeDaysKey(day, 1)) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  function stateOf(day: string): CellState {
    if (day < todayKey) {
      return "past";
    }
    if (excluded.has(day)) {
      return "off";
    }
    if (pattern.has(singaporeIsoWeekday(day))) {
      return "work";
    }
    return extra.has(day) ? "extra" : "rest";
  }

  const stateClass: Record<CellState, string> = {
    past: "bg-tt42-surface2 text-tt42-muted",
    off: "bg-tt42-danger/10 text-tt42-muted",
    work: "bg-tt42-accent/15 text-tt42-text hover:bg-tt42-accent/25",
    extra: "bg-tt42-accent/15 text-tt42-text ring-1 ring-inset ring-tt42-accent hover:bg-tt42-accent/25",
    rest: "text-tt42-muted ring-1 ring-inset ring-tt42-border hover:bg-tt42-surface2"
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-tt42-muted">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`blank-${index}`} className="h-14" />;
          }

          const state = stateOf(day);
          const isPast = state === "past";
          const planned = plannedSecondsByDay[day] ?? 0;
          const attended = attendedSecondsByDay[day] ?? 0;

          let detail = "";
          if (isPast) {
            detail = attended > 0 ? hoursToCompact(attended / 3600) : "";
          } else if (state === "off") {
            detail = "off";
          } else if (state === "work" || state === "extra") {
            detail = planned > 0 ? hoursToCompact(planned / 3600) : "";
          }

          const description =
            state === "past"
              ? "past day"
              : state === "off"
                ? "day off"
                : state === "rest"
                  ? "not planned"
                  : state === "extra"
                    ? "extra working day"
                    : "working day";

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              aria-pressed={!isPast && (state === "work" || state === "extra")}
              aria-label={`${day}, ${description}${detail && !isPast && state !== "off" ? `, ${detail}` : ""}`}
              onClick={() => onToggleDay(day)}
              className={[
                "flex h-14 flex-col items-center justify-center rounded-lg px-1 text-center transition",
                stateClass[state],
                day === todayKey ? "outline outline-2 -outline-offset-2 outline-tt42-text/60" : "",
                isPast ? "cursor-default" : "cursor-pointer"
              ].join(" ")}
            >
              <span className="text-sm font-semibold tabular-nums">{singaporeDayOfMonthLabel(day)}</span>
              <span className="mt-0.5 text-[11px] tabular-nums text-tt42-muted">{detail}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-tt42-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm bg-tt42-accent/15" />
          Working day
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm bg-tt42-accent/15 ring-1 ring-inset ring-tt42-accent" />
          Extra day
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm bg-tt42-danger/10" />
          Day off
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-4 rounded-sm bg-tt42-surface2" />
          Past
        </li>
      </ul>
    </div>
  );
}
