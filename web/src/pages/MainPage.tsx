import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { AttendanceMonthCalendar } from "../components/main/AttendanceMonthCalendar";
import { ConcentricProgressRings, type RingMetric } from "../components/main/ConcentricProgressRings";
import { MetricCard } from "../components/main/MetricCard";
import { StaleDataBanner } from "../components/main/StaleDataBanner";
import {
  getAttendanceHistory,
  getDashboardSummary,
  triggerManualSync,
  type AttendanceHistory,
  type DashboardSummary
} from "../lib/api/dashboardApi";
import { ApiError } from "../lib/api/http";
import { useAuth } from "../lib/auth";
import { deltaHoursReadable, hoursToReadable } from "../lib/formatters";

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

function useWeekdaysPaceMode(mode: string): boolean {
  return mode.toLowerCase().includes("weekday");
}

function statusTag(summary: DashboardSummary): { text: string; className: string } {
  if (summary.hoursLeftToMonthlyGoal <= 0) {
    return {
      text: "Exceeded",
      className: "border-tt42-magenta/40 bg-tt42-magenta/15 text-tt42-text"
    };
  }

  const activePace = useWeekdaysPaceMode(summary.paceMode)
    ? summary.requiredHoursPerRemainingWeekday
    : summary.requiredHoursPerRemainingDay;

  if (activePace <= summary.dailyGoalHours) {
    return {
      text: "On Track",
      className: "border-tt42-mint/40 bg-tt42-mint/15 text-tt42-text"
    };
  }

  return {
    text: "Behind Pace",
    className: "border-amber-400/40 bg-amber-400/15 text-tt42-text"
  };
}

export function MainPage() {
  const queryClient = useQueryClient();
  const { validAccessToken, signOut } = useAuth();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const dashboardQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      try {
        return await getDashboardSummary(accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await signOut();
        }
        throw error;
      }
    }
  });

  const monthHistoryQuery = useQuery({
    queryKey: ["attendance-history-month", monthStart, monthEnd],
    enabled: dashboardQuery.isSuccess,
    queryFn: async () => {
      const accessToken = await validAccessToken();
      try {
        return await getAttendanceHistory(accessToken, {
          from: monthStart,
          to: monthEnd
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await signOut();
        }
        throw error;
      }
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await validAccessToken();
      try {
        return await triggerManualSync(accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await signOut();
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-history-month"] })
      ]);
    }
  });

  const isRefreshing = dashboardQuery.isFetching || monthHistoryQuery.isFetching;
  const summary = dashboardQuery.data ?? null;
  const monthHistory = monthHistoryQuery.data ?? null;

  const ringMetrics: RingMetric[] =
    summary === null
      ? []
      : [
          {
            id: "month",
            label: "Month",
            valueHours: summary.hoursMonth,
            goalHours: summary.monthlyGoalHours,
            tone: "magenta"
          },
          {
            id: "week",
            label: "Week",
            valueHours: summary.hoursWeek,
            goalHours: summary.weeklyGoalHours,
            tone: "mint"
          },
          {
            id: "day",
            label: "Day",
            valueHours: summary.hoursToday,
            goalHours: summary.dailyGoalHours,
            tone: "teal"
          }
        ];

  const activePaceHours =
    summary === null
      ? 0
      : useWeekdaysPaceMode(summary.paceMode)
        ? summary.requiredHoursPerRemainingWeekday
        : summary.requiredHoursPerRemainingDay;

  const displayError =
    dashboardQuery.error ?? monthHistoryQuery.error ?? syncMutation.error ?? null;

  if (dashboardQuery.isPending) {
    return (
      <section className="space-y-4 pb-2">
        <div className="h-80 animate-pulse rounded-card border border-tt42-border bg-tt42-surface2" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-tt42-border bg-tt42-surface2" />
          ))}
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="space-y-4 pb-2">
        <article className="rounded-card border border-tt42-danger/40 bg-tt42-danger/10 p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
          <p className="mt-2 text-sm text-tt42-muted">{errorText(displayError)}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-tt42-border bg-tt42-surface px-3 py-2 text-sm"
            onClick={() => {
              void dashboardQuery.refetch();
            }}
          >
            Try again
          </button>
        </article>
      </section>
    );
  }

  const status = statusTag(summary);

  return (
    <section className="space-y-4 pb-2">
      <article className="rounded-card border border-tt42-border bg-gradient-to-b from-tt42-surface2/70 to-tt42-surface p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Main</p>
            <h2 className="text-xl font-semibold">Attendance Progress</h2>
          </div>
          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}>
            {status.text}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              void Promise.all([dashboardQuery.refetch(), monthHistoryQuery.refetch()]);
            }}
            disabled={isRefreshing || syncMutation.isPending}
            className="rounded-lg border border-tt42-border bg-tt42-surface px-3 py-2 text-xs font-medium text-tt42-text disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              syncMutation.reset();
              syncMutation.mutate();
            }}
            disabled={isRefreshing || syncMutation.isPending}
            className="rounded-lg border border-tt42-magenta/40 bg-tt42-magenta/15 px-3 py-2 text-xs font-medium text-tt42-text disabled:opacity-60"
          >
            {syncMutation.isPending ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        <StaleDataBanner
          isStale={summary.isStale}
          staleAgeHours={summary.staleAgeHours}
          lastSyncedAt={summary.lastSyncedAt}
        />

        <div className="mt-4">
          <ConcentricProgressRings
            metrics={ringMetrics}
            centerValue={hoursToReadable(summary.hoursMonth)}
            centerLabel="Monthly Hours"
          />
        </div>
      </article>

      {displayError && (
        <article className="rounded-xl border border-tt42-danger/40 bg-tt42-danger/10 px-3 py-2 text-sm text-tt42-text">
          {errorText(displayError)}
        </article>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Today"
          value={hoursToReadable(summary.hoursToday)}
          subtitle={`Goal ${hoursToReadable(summary.dailyGoalHours)}`}
          tint="teal"
        />
        <MetricCard
          title="This Week"
          value={hoursToReadable(summary.hoursWeek)}
          subtitle={`Goal ${hoursToReadable(summary.weeklyGoalHours)}`}
          tint="mint"
        />
        <MetricCard
          title="Hours Left"
          value={hoursToReadable(Math.max(summary.hoursLeftToMonthlyGoal, 0))}
          subtitle={`Month goal ${hoursToReadable(summary.monthlyGoalHours)}`}
          tint="magenta"
        />
        <MetricCard
          title="Required Pace"
          value={`${hoursToReadable(activePaceHours)}/day`}
          subtitle={useWeekdaysPaceMode(summary.paceMode) ? "Using weekdays mode" : "Using all days mode"}
        />
        <MetricCard
          title="Week Delta"
          value={deltaHoursReadable(summary.weekVsPreviousWeekHours)}
          subtitle="vs previous week"
        />
        <MetricCard
          title="Month Delta"
          value={deltaHoursReadable(summary.monthVsPreviousMonthHours)}
          subtitle="vs previous month"
        />
      </div>

      {monthHistory ? (
        <AttendanceMonthCalendar
          month={new Date()}
          dailyGoalHours={summary.dailyGoalHours}
          weeklyGoalHours={summary.weeklyGoalHours}
          days={monthHistory.days}
        />
      ) : (
        <article className="rounded-card border border-tt42-border bg-tt42-surface p-5 shadow-soft">
          <h3 className="text-lg font-semibold">Monthly Attendance Calendar</h3>
          <p className="mt-2 text-sm text-tt42-muted">{monthHistoryQuery.isPending ? "Loading..." : "Unavailable."}</p>
        </article>
      )}

      <RangeSummary summary={summary} monthHistory={monthHistory} />
    </section>
  );
}

function RangeSummary({ summary, monthHistory }: { summary: DashboardSummary; monthHistory: AttendanceHistory | null }) {
  const coverage = monthHistory
    ? `${monthHistory.fromDate} to ${monthHistory.toDate}`
    : "Current month range not loaded";

  return (
    <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
      <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Snapshot</p>
      <h3 className="mt-1 text-lg font-semibold">Current Month</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-tt42-muted sm:grid-cols-2">
        <p>Coverage: {coverage}</p>
        <p>Total hours: {hoursToReadable(monthHistory?.totalHours ?? summary.hoursMonth)}</p>
        <p>Days in range: {monthHistory?.totalDays ?? 0}</p>
        <p>Pace mode: {useWeekdaysPaceMode(summary.paceMode) ? "Weekdays" : "All days"}</p>
      </div>
    </article>
  );
}
