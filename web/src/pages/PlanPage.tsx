import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { getAttendanceHistory } from "../lib/api/dashboardApi";
import { defaultPlan, getPlan, savePlan, type AttendancePlan } from "../lib/api/planApi";
import { getCurrentGoals } from "../lib/api/settingsApi";
import { useAuth } from "../lib/auth";
import { hoursToReadable } from "../lib/formatters";
import { buildPlan, nextMonthKey, toggleDay, type Suggestion } from "../lib/planner";
import {
  dayKeyToSingaporeCalendarDate,
  endOfSingaporeMonthKey,
  singaporeCalendarMonthDate,
  singaporeDayKey,
  singaporeMonthKey,
  singaporeMonthLongLabel
} from "../lib/singaporeDate";
import { Card } from "../components/ui/Card";
import { buttonClass } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";
import { PlanCalendar } from "../components/plan/PlanCalendar";
import { Skeleton } from "../components/ui/Skeleton";

const WEEKDAYS = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" }
];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function dayLabel(dayKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(dayKeyToSingaporeCalendarDate(dayKey));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function sameList<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function PlanPage() {
  const queryClient = useQueryClient();
  const { validAccessToken } = useAuth();

  const todayKey = singaporeDayKey();
  const thisMonth = singaporeMonthKey();
  const [monthKey, setMonthKey] = useState(thisMonth);
  const monthEnd = endOfSingaporeMonthKey(singaporeCalendarMonthDate(monthKey));

  const [draft, setDraft] = useState<AttendancePlan>(defaultPlan(thisMonth));
  const [maxHoursInput, setMaxHoursInput] = useState("8");

  const goalsQuery = useQuery({
    queryKey: ["goals-current"],
    queryFn: async () => getCurrentGoals(await validAccessToken())
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance-plan-month", monthKey],
    queryFn: async () =>
      getAttendanceHistory(await validAccessToken(), { from: `${monthKey}-01`, to: monthEnd })
  });

  const planQuery = useQuery({
    queryKey: ["attendance-plan", monthKey],
    queryFn: async () => getPlan(await validAccessToken(), monthKey)
  });

  useEffect(() => {
    if (!planQuery.data) {
      return;
    }
    setDraft(planQuery.data);
    setMaxHoursInput(String(planQuery.data.maxHoursPerDay));
  }, [planQuery.data]);

  const maxHours = Math.min(Math.max(Number(maxHoursInput) || 0, 0), 24);

  const attendedByDay = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const entry of attendanceQuery.data?.days ?? []) {
      byDay[entry.day] = entry.durationSeconds ?? Math.round(entry.hours * 3600);
    }
    return byDay;
  }, [attendanceQuery.data]);

  const monthlyGoalHours = goalsQuery.data?.monthlyGoalHours ?? 0;

  const result = useMemo(
    () =>
      buildPlan({
        todayKey,
        monthKey,
        targetSeconds: Math.round(monthlyGoalHours * 3600),
        attendedByDay,
        weekdays: draft.weekdays,
        extraDays: draft.extraDays,
        excludedDays: draft.excludedDays,
        maxSecondsPerDay: Math.round(maxHours * 3600)
      }),
    [attendedByDay, draft.excludedDays, draft.extraDays, draft.weekdays, maxHours, monthKey, monthlyGoalHours, todayKey]
  );

  const saved = planQuery.data;
  const isDirty =
    !!saved &&
    (!sameList(saved.weekdays, draft.weekdays) ||
      !sameList(saved.extraDays, draft.extraDays) ||
      !sameList(saved.excludedDays, draft.excludedDays) ||
      saved.maxHoursPerDay !== maxHours);

  const saveMutation = useMutation({
    mutationFn: async () =>
      savePlan(await validAccessToken(), { ...draft, month: monthKey, maxHoursPerDay: maxHours }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance-plan", monthKey] });
    }
  });

  function toggleWeekday(iso: number) {
    setDraft((current) => {
      const next = current.weekdays.includes(iso)
        ? current.weekdays.filter((value) => value !== iso)
        : [...current.weekdays, iso];
      return { ...current, weekdays: next.sort((a, b) => a - b) };
    });
  }

  function toggleCalendarDay(day: string) {
    setDraft((current) => ({ ...current, ...toggleDay(current, day) }));
  }

  function applySuggestion(suggestion: Suggestion) {
    if (suggestion.kind === "raise_cap") {
      setMaxHoursInput(String(Number((suggestion.maxSecondsPerDay / 3600).toFixed(2))));
      return;
    }
    setDraft((current) => ({ ...current, extraDays: unique([...current.extraDays, ...suggestion.days]) }));
  }

  const isLoading = goalsQuery.isPending || attendanceQuery.isPending || planQuery.isPending;
  const loadError = goalsQuery.error ?? attendanceQuery.error ?? planQuery.error ?? null;
  const plannedRows = result.plannedDays.filter((day) => day.seconds > 0);
  const plannedSecondsByDay = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const planned of result.plannedDays) {
      byDay[planned.day] = planned.seconds;
    }
    return byDay;
  }, [result.plannedDays]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 pb-2">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Planner</p>
            <h2 className="text-lg font-semibold">{singaporeMonthLongLabel(monthKey)}</h2>
          </div>
          <div className="flex gap-1">
            {[thisMonth, nextMonthKey(thisMonth)].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMonthKey(key)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs",
                  monthKey === key
                    ? "border-tt42-accent bg-tt42-accent/15"
                    : "border-tt42-border bg-tt42-surface2 text-tt42-muted"
                ].join(" ")}
              >
                {key === thisMonth ? "This month" : "Next month"}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-2 text-sm text-tt42-muted">
          Choose the days you can attend and a daily limit. The planner shows whether your monthly goal
          is reachable and how to adjust if it is not. Campus attendance only, not study time.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-tt42-surface2 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-tt42-muted">Goal</p>
            <p className="mt-1 text-base font-semibold">{hoursToReadable(monthlyGoalHours)}</p>
          </div>
          <div className="rounded-xl bg-tt42-surface2 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-tt42-muted">Attended</p>
            <p className="mt-1 text-base font-semibold">{hoursToReadable(result.attendedSeconds / 3600)}</p>
          </div>
          <div className="rounded-xl bg-tt42-surface2 p-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-tt42-muted">Remaining</p>
            <p className="mt-1 text-base font-semibold">{hoursToReadable(result.remainingSeconds / 3600)}</p>
          </div>
        </div>
      </Card>

      {loadError ? (
        <Banner tone="danger">
          {errorText(loadError)}
        </Banner>
      ) : null}

      <Card>
        <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Your schedule</p>

        <p className="mt-3 text-sm text-tt42-muted">Days I can attend</p>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((weekday) => {
            const active = draft.weekdays.includes(weekday.iso);
            return (
              <button
                key={weekday.iso}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWeekday(weekday.iso)}
                className={[
                  "h-10 rounded-lg border text-xs font-medium",
                  active
                    ? "border-tt42-accent bg-tt42-accent/15"
                    : "border-tt42-border bg-tt42-surface2 text-tt42-muted"
                ].join(" ")}
              >
                {weekday.label}
              </button>
            );
          })}
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-tt42-muted">Most hours I will stay on one day</span>
          <input
            type="number"
            min={0.5}
            max={24}
            step="0.5"
            value={maxHoursInput}
            onChange={(event) => setMaxHoursInput(event.target.value)}
            className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
          />
        </label>

        <div className="mt-5">
          <p className="text-sm text-tt42-muted">Tap a day to take it off, or to add an extra day</p>
          <div className="mt-2">
            <PlanCalendar
              monthKey={monthKey}
              todayKey={todayKey}
              weekdays={draft.weekdays}
              extraDays={draft.extraDays}
              excludedDays={draft.excludedDays}
              plannedSecondsByDay={plannedSecondsByDay}
              attendedSecondsByDay={attendedByDay}
              onToggleDay={toggleCalendarDay}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-tt42-muted">
            {saveMutation.isSuccess && !isDirty ? "Saved." : isDirty ? "Unsaved changes." : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              saveMutation.reset();
              saveMutation.mutate();
            }}
            disabled={!isDirty || saveMutation.isPending || isLoading}
            className={buttonClass({ variant: "primary", size: "md" })}
          >
            {saveMutation.isPending ? "Saving..." : "Save plan"}
          </button>
        </div>
        {saveMutation.error ? (
          <p className="mt-2 text-sm text-tt42-danger">{errorText(saveMutation.error)}</p>
        ) : null}
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Result</p>

        {isLoading ? (
          <Skeleton className="mt-3 h-20 w-full" />
        ) : result.remainingSeconds === 0 ? (
          <Banner tone="success" className="mt-3">
            Goal reached for this month. Nothing left to plan.
          </Banner>
        ) : result.feasible ? (
          <Banner tone="success" className="mt-3">
            <p className="font-semibold">Reachable</p>
            <p className="mt-1">
              Averaging {hoursToReadable(result.requiredPerDaySeconds / 3600)} a day over{" "}
              {result.workableDays.length} day(s) gets you to your goal.
            </p>
          </Banner>
        ) : (
          <Banner tone="danger" className="mt-3">
            <p className="font-semibold">Not reachable with this schedule</p>
            <p className="mt-1">
              You would still be {hoursToReadable(result.shortfallSeconds / 3600)} short, even at{" "}
              {hoursToReadable(maxHours)} on every available day
              {result.workableDays.length === 0 ? " (no available days left)" : ""}.
            </p>
          </Banner>
        )}

        {result.suggestions.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Ways to fix it</p>
            {result.suggestions.map((suggestion) => (
              <div
                key={suggestion.kind}
                className="flex items-center justify-between gap-3 rounded-xl bg-tt42-surface2 px-3 py-2 text-sm"
              >
                <p>
                  {suggestion.kind === "raise_cap"
                    ? `Allow up to ${hoursToReadable(suggestion.maxSecondsPerDay / 3600)} a day`
                    : `Also attend ${suggestion.days.map(dayLabel).join(", ")}`}
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {plannedRows.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Day by day</p>
            <ul className="mt-2 divide-y divide-tt42-border rounded-xl bg-tt42-surface2">
              {plannedRows.map((day) => (
                <li key={day.day} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {dayLabel(day.day)}
                    {day.day === todayKey ? <span className="ml-2 text-xs text-tt42-muted">today</span> : null}
                  </span>
                  <span className="font-medium">{hoursToReadable(day.seconds / 3600)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
