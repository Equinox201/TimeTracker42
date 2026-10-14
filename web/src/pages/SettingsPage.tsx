import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getAttendanceHistory, getDashboardSummary } from "../lib/api/dashboardApi";
import {
  createDeadline,
  deleteDeadline,
  getCurrentGoals,
  listDeadlines,
  upsertCurrentGoals,
  updateDeadline,
  type Deadline
} from "../lib/api/settingsApi";
import { useAuth } from "../lib/auth";
import { deadlineProgress } from "../lib/deadlines";
import { hoursToReadable, monthYearLabel } from "../lib/formatters";
import {
  buildRecommendedPace,
  deriveGoalDraft,
  formatGoalInput,
  type GoalInputMode,
  type PaceMode
} from "../lib/goalMath";
import { singaporeDayKey, startOfSingaporeMonthKey } from "../lib/singaporeDate";
import { useTheme } from "../lib/theme";
import { Card } from "../components/ui/Card";
import { buttonClass } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

function asNumber(input: string, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { preference, setPreference } = useTheme();
  const { session, signOut, validAccessToken } = useAuth();

  const [monthlyGoalInput, setMonthlyGoalInput] = useState("90");
  const [weeklyGoalInput, setWeeklyGoalInput] = useState("22.5");
  const [dailyGoalInput, setDailyGoalInput] = useState("6");
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [goalInputMode, setGoalInputMode] = useState<GoalInputMode>("monthly");

  const [newDeadlineTitle, setNewDeadlineTitle] = useState("");
  const [newDeadlineStart, setNewDeadlineStart] = useState(singaporeDayKey());
  const [newDeadlineDate, setNewDeadlineDate] = useState(toISODate(new Date()));
  const [newDeadlineHours, setNewDeadlineHours] = useState("90");
  const [newDeadlineNotes, setNewDeadlineNotes] = useState("");

  const goalsQuery = useQuery({
    queryKey: ["goals-current"],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return getCurrentGoals(accessToken);
    }
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return getDashboardSummary(accessToken);
    }
  });

  const deadlinesQuery = useQuery({
    queryKey: ["deadlines"],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return listDeadlines(accessToken);
    }
  });

  const todayKey = singaporeDayKey();
  // Each deadline is measured from its own start date, so load attendance back to the earliest one.
  const deadlinesFrom = (deadlinesQuery.data ?? []).reduce(
    (earliest, deadline) => (deadline.startOn < earliest ? deadline.startOn : earliest),
    startOfSingaporeMonthKey()
  );
  const deadlineAttendanceQuery = useQuery({
    queryKey: ["attendance-deadlines", deadlinesFrom, todayKey],
    enabled: deadlinesQuery.isSuccess,
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return getAttendanceHistory(accessToken, { from: deadlinesFrom, to: todayKey });
    }
  });
  const hoursByDay = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const entry of deadlineAttendanceQuery.data?.days ?? []) {
      byDay[entry.day] = entry.hours;
    }
    return byDay;
  }, [deadlineAttendanceQuery.data]);

  useEffect(() => {
    const payload = goalsQuery.data;
    if (!payload) {
      return;
    }

    setMonthlyGoalInput(String(payload.monthlyGoalHours));
    setWeeklyGoalInput(String(payload.weeklyGoalHours));
    setDailyGoalInput(String(payload.dailyGoalHours));
    setWeekdaysOnly(payload.paceMode === "weekdays");
    setDaysPerWeek(payload.daysPerWeek);
    setGoalInputMode("monthly");
  }, [goalsQuery.data]);

  const monthlyGoalHours = asNumber(monthlyGoalInput, 90);
  const weeklyGoalHours = asNumber(weeklyGoalInput, 22.5);
  const dailyGoalHours = asNumber(dailyGoalInput, 6);
  const monthlyHoursSoFar = dashboardQuery.data?.hoursMonth ?? 0;
  const currentPaceMode: PaceMode = weekdaysOnly ? "weekdays" : "calendar_days";
  const effectiveFrom = startOfMonth(new Date());

  const recommendation = useMemo(() => {
    return buildRecommendedPace({
      monthlyGoalHours,
      monthlyHoursSoFar,
      paceMode: currentPaceMode,
      daysPerWeek,
      fromDate: new Date()
    });
  }, [currentPaceMode, daysPerWeek, monthlyGoalHours, monthlyHoursSoFar]);

  function applyDerivedDraft(inputMode: GoalInputMode, inputHours: number, nextPaceMode = currentPaceMode, nextDaysPerWeek = daysPerWeek) {
    const draft = deriveGoalDraft({
      inputMode,
      inputGoalHours: inputHours,
      paceMode: nextPaceMode,
      daysPerWeek: nextDaysPerWeek,
      effectiveFrom
    });

    setGoalInputMode(inputMode);
    setMonthlyGoalInput(formatGoalInput(draft.monthlyGoalHours));
    setWeeklyGoalInput(formatGoalInput(draft.weeklyGoalHours));
    setDailyGoalInput(formatGoalInput(draft.dailyGoalHours));
    setWeekdaysOnly(draft.paceMode === "weekdays");
    setDaysPerWeek(draft.daysPerWeek);
  }

  function currentGoalInputValue(mode: GoalInputMode): number {
    if (mode === "daily") {
      return dailyGoalHours;
    }
    if (mode === "weekly") {
      return weeklyGoalHours;
    }
    return monthlyGoalHours;
  }

  const saveGoalsMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await validAccessToken();
      return upsertCurrentGoals(accessToken, {
        inputMode: goalInputMode,
        inputGoalHours: currentGoalInputValue(goalInputMode),
        paceMode: currentPaceMode,
        daysPerWeek,
        effectiveFrom: toISODate(effectiveFrom)
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals-current"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-history-month"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-history-range"] })
      ]);
    }
  });

  const createDeadlineMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await validAccessToken();
      return createDeadline(accessToken, {
        title: newDeadlineTitle.trim(),
        startOn: newDeadlineStart,
        targetDate: newDeadlineDate,
        targetHours: asNumber(newDeadlineHours, 0),
        notes: newDeadlineNotes.trim() ? newDeadlineNotes.trim() : null
      });
    },
    onSuccess: async () => {
      setNewDeadlineTitle("");
      setNewDeadlineHours("90");
      setNewDeadlineNotes("");
      setNewDeadlineStart(singaporeDayKey());
      setNewDeadlineDate(toISODate(new Date()));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deadlines"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-deadlines"] })
      ]);
    }
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async (deadline: Deadline) => {
      const accessToken = await validAccessToken();
      return updateDeadline(accessToken, deadline.id, {
        isCompleted: !deadline.isCompleted
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deadlines"] });
    }
  });

  const deleteDeadlineMutation = useMutation({
    mutationFn: async (deadlineId: string) => {
      const accessToken = await validAccessToken();
      await deleteDeadline(accessToken, deadlineId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deadlines"] });
    }
  });

  const settingsError = goalsQuery.error ?? saveGoalsMutation.error ?? null;
  const deadlineError = deadlinesQuery.error ?? createDeadlineMutation.error ?? toggleCompleteMutation.error ?? deleteDeadlineMutation.error ?? null;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 pb-2">
      <Card>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-tt42-muted">Appearance, account, goals, pace mode, and deadline planning.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["system", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPreference(mode)}
              className={[
                "h-10 rounded-lg border text-sm capitalize",
                preference === mode
                  ? "border-tt42-accent bg-tt42-accent/15"
                  : "border-tt42-border bg-tt42-surface2 text-tt42-muted"
              ].join(" ")}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl bg-tt42-surface2 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Account</p>
          <p className="mt-2 text-sm font-medium">{session?.user.displayName ?? "Unknown User"}</p>
          <p className="text-xs text-tt42-muted">@{session?.user.login ?? "unknown"}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className={buttonClass({ variant: "danger", size: "sm", className: "mt-3" })}
          >
            Sign out
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Goals</p>
            <h3 className="text-lg font-semibold">Goal Targets</h3>
          </div>
          <span className="rounded-full border border-tt42-border px-3 py-1 text-xs text-tt42-muted">
            {monthYearLabel(new Date())}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Monthly goal (hours)</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={monthlyGoalInput}
              onChange={(event) => applyDerivedDraft("monthly", asNumber(event.target.value, 0))}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Weekly goal (hours)</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={weeklyGoalInput}
              onChange={(event) => applyDerivedDraft("weekly", asNumber(event.target.value, 0))}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Daily goal (hours)</span>
            <input
              type="number"
              min={0}
              step="0.25"
              value={dailyGoalInput}
              onChange={(event) => applyDerivedDraft("daily", asNumber(event.target.value, 0))}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-tt42-surface2 p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Use weekdays only for pace</label>
            <button
              type="button"
              role="switch"
              aria-checked={weekdaysOnly}
              onClick={() =>
                applyDerivedDraft(
                  goalInputMode,
                  currentGoalInputValue(goalInputMode),
                  weekdaysOnly ? "calendar_days" : "weekdays",
                  daysPerWeek
                )
              }
              className={[
                "inline-flex h-7 w-14 items-center rounded-full border px-1 transition",
                weekdaysOnly ? "border-tt42-accent bg-tt42-accent/25" : "border-tt42-border bg-tt42-surface"
              ].join(" ")}
            >
              <span
                className={[
                  "h-5 w-5 rounded-full bg-tt42-text transition",
                  weekdaysOnly ? "translate-x-7" : "translate-x-0"
                ].join(" ")}
              />
            </button>
          </div>

          <div className="mt-3">
            <label className="text-sm">
              <span className="mb-1 block text-tt42-muted">Days attended per week</span>
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                value={daysPerWeek}
                onChange={(event) =>
                  applyDerivedDraft(
                    goalInputMode,
                    currentGoalInputValue(goalInputMode),
                    currentPaceMode,
                    clamp(Number(event.target.value), 1, 7)
                  )
                }
                className="w-full accent-tt42-accent"
              />
              <div className="mt-1 text-sm text-tt42-muted">{daysPerWeek} day(s) / week</div>
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-tt42-surface2 p-3">
          <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Recalculated Guidance</p>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-tt42-muted sm:grid-cols-2">
            <p>Target days left this month: {recommendation.targetDays}</p>
            <p>Remaining month target: {hoursToReadable(recommendation.remainingHours)}</p>
            <p>Recommended daily pace: {hoursToReadable(recommendation.recDaily)}</p>
            <p>Recommended weekly pace: {hoursToReadable(recommendation.recWeekly)}</p>
            <p>Current month hours: {hoursToReadable(monthlyHoursSoFar)}</p>
            <p>Edited field: {goalInputMode}</p>
          </div>
          <p className="mt-3 text-xs text-tt42-muted">
            This is guidance only and never changes your goal. To see whether your target fits the days you
            can attend, use the planner.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/app/plan"
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Open the planner
            </Link>
          </div>
        </div>

        {settingsError && (
          <Banner tone="danger" className="mt-3">
            {errorText(settingsError)}
          </Banner>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              const payload = goalsQuery.data;
              if (!payload) {
                return;
              }
              setMonthlyGoalInput(String(payload.monthlyGoalHours));
              setWeeklyGoalInput(String(payload.weeklyGoalHours));
              setDailyGoalInput(String(payload.dailyGoalHours));
              setWeekdaysOnly(payload.paceMode === "weekdays");
              setDaysPerWeek(payload.daysPerWeek);
              setGoalInputMode("monthly");
            }}
            className={buttonClass({ variant: "secondary", size: "md" })}
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => {
              saveGoalsMutation.reset();
              saveGoalsMutation.mutate();
            }}
            disabled={saveGoalsMutation.isPending || goalsQuery.isPending}
            className={buttonClass({ variant: "primary", size: "md" })}
          >
            {saveGoalsMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Deadlines</p>
        <h3 className="text-lg font-semibold">Project Deadline Planning</h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-tt42-muted">Title</span>
            <input
              type="text"
              value={newDeadlineTitle}
              onChange={(event) => setNewDeadlineTitle(event.target.value)}
              placeholder="Piscine checkpoint"
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Counted from</span>
            <input
              type="date"
              value={newDeadlineStart}
              onChange={(event) => setNewDeadlineStart(event.target.value)}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Target date</span>
            <input
              type="date"
              value={newDeadlineDate}
              onChange={(event) => setNewDeadlineDate(event.target.value)}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-tt42-muted">Target hours</span>
            <input
              type="number"
              min={0.1}
              step="0.5"
              value={newDeadlineHours}
              onChange={(event) => setNewDeadlineHours(event.target.value)}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-tt42-muted">Notes</span>
            <textarea
              value={newDeadlineNotes}
              onChange={(event) => setNewDeadlineNotes(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (!newDeadlineTitle.trim() || asNumber(newDeadlineHours, 0) <= 0) {
                return;
              }
              createDeadlineMutation.reset();
              createDeadlineMutation.mutate();
            }}
            disabled={createDeadlineMutation.isPending}
            className={buttonClass({ variant: "primary", size: "md" })}
          >
            {createDeadlineMutation.isPending ? "Adding..." : "Add Deadline"}
          </button>
        </div>

        {deadlineError && (
          <Banner tone="danger" className="mt-3">
            {errorText(deadlineError)}
          </Banner>
        )}

        <div className="mt-4 space-y-3">
          {deadlinesQuery.isPending ? (
            <div className="rounded-xl bg-tt42-surface2 px-3 py-3 text-sm text-tt42-muted">Loading deadlines...</div>
          ) : (deadlinesQuery.data ?? []).length === 0 ? (
            <div className="rounded-xl bg-tt42-surface2 px-3 py-3 text-sm text-tt42-muted">
              No deadlines yet.
            </div>
          ) : (
            (deadlinesQuery.data ?? []).map((deadline) => {
              const pace = deadlineProgress({
                startOn: deadline.startOn,
                dueOn: deadline.targetDate,
                targetHours: deadline.targetHours,
                todayKey,
                hoursByDay,
                weekdaysOnly
              });
              return (
                <article key={deadline.id} className="rounded-xl bg-tt42-surface2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold">{deadline.title}</h4>
                      <p className="text-xs text-tt42-muted">Due {deadline.targetDate}</p>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        deadline.isCompleted
                          ? "border-tt42-accent/40 bg-tt42-accent/20"
                          : "border-tt42-border bg-tt42-surface"
                      ].join(" ")}
                    >
                      {deadline.isCompleted ? "Completed" : "Open"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-tt42-muted sm:grid-cols-3">
                    <p>Target: {hoursToReadable(deadline.targetHours)}</p>
                    <p>Attended: {hoursToReadable(pace.attendedHours)}</p>
                    <p>Hours left: {hoursToReadable(pace.hoursLeft)}</p>
                    <p>Required/day: {hoursToReadable(pace.requiredPerDay)}</p>
                    <p>Days left: {pace.daysLeft}</p>
                    <p>
                      Counted from {deadline.startOn}
                      {pace.status === "overdue" ? " · overdue" : pace.status === "achieved" ? " · target met" : ""}
                    </p>
                  </div>

                  {deadline.notes && <p className="mt-2 text-xs text-tt42-muted">{deadline.notes}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        toggleCompleteMutation.reset();
                        toggleCompleteMutation.mutate(deadline);
                      }}
                      disabled={toggleCompleteMutation.isPending}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                    >
                      {deadline.isCompleted ? "Mark Open" : "Mark Complete"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        deleteDeadlineMutation.reset();
                        deleteDeadlineMutation.mutate(deadline.id);
                      }}
                      disabled={deleteDeadlineMutation.isPending}
                      className={buttonClass({ variant: "danger", size: "sm" })}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Card>
    </section>
  );
}
