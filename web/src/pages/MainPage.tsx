import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { useAuth } from "../lib/auth";
import { deltaHoursReadable, hoursToReadable, progressPercent, shortDateTime } from "../lib/formatters";
import { endOfSingaporeMonthKey, singaporeMonthKey, startOfSingaporeMonthKey } from "../lib/singaporeDate";
import { Card } from "../components/ui/Card";
import { buttonClass } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";

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
      className: "bg-tt42-accent/15 text-tt42-accent"
    };
  }

  const activePace = useWeekdaysPaceMode(summary.paceMode)
    ? summary.requiredHoursPerRemainingWeekday
    : summary.requiredHoursPerRemainingDay;

  if (activePace <= summary.dailyGoalHours) {
    return {
      text: "On Track",
      className: "bg-tt42-accent/15 text-tt42-accent"
    };
  }

  return {
    text: "Behind Pace",
    className: "bg-tt42-warn/15 text-tt42-warn"
  };
}

function syncSuccessText(data: { insertedDays: number; updatedDays: number; unchangedDays: number; finishedAt: string }): string {
  const changedDays = data.insertedDays + data.updatedDays;
  const unchanged = data.unchangedDays;
  const detail =
    changedDays > 0
      ? `${changedDays} day${changedDays === 1 ? "" : "s"} updated`
      : `${unchanged} day${unchanged === 1 ? "" : "s"} unchanged`;
  return `Sync complete at ${shortDateTime(data.finishedAt)}. ${detail}.`;
}

export function MainPage() {
  const queryClient = useQueryClient();
  const { validAccessToken } = useAuth();

  const now = new Date();
  // attendance_daily.day uses Singapore operational dates, so the current month query follows Singapore time.
  const currentMonthKey = singaporeMonthKey(now);
  const monthStart = startOfSingaporeMonthKey(now);
  const monthEnd = endOfSingaporeMonthKey(now);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return getDashboardSummary(accessToken);
    }
  });

  const monthHistoryQuery = useQuery({
    queryKey: ["attendance-history-month", monthStart, monthEnd],
    enabled: dashboardQuery.isSuccess,
    queryFn: async () => {
      const accessToken = await validAccessToken();
      return getAttendanceHistory(accessToken, {
        from: monthStart,
        to: monthEnd
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await validAccessToken();
      return triggerManualSync(accessToken);
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
            tone: "strong"
          },
          {
            id: "week",
            label: "Week",
            valueHours: summary.hoursWeek,
            goalHours: summary.weeklyGoalHours,
            tone: "medium"
          },
          {
            id: "day",
            label: "Day",
            valueHours: summary.hoursToday,
            goalHours: summary.dailyGoalHours,
            tone: "soft"
          }
        ];

  const activePaceHours =
    summary === null
      ? 0
      : useWeekdaysPaceMode(summary.paceMode)
        ? summary.requiredHoursPerRemainingWeekday
        : summary.requiredHoursPerRemainingDay;

  const displayError = dashboardQuery.error ?? monthHistoryQuery.error ?? null;

  if (dashboardQuery.isPending) {
    return (
      <section className="space-y-4 pb-2">
        <div className="h-80 animate-pulse rounded-card border border-tt42-border bg-tt42-surface2" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-tt42-surface2" />
          ))}
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="space-y-4 pb-2">
        <Card>
          <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
          <p className="mt-2 text-sm text-tt42-muted">{errorText(displayError)}</p>
          <button
            type="button"
            className={buttonClass({ variant: "secondary", size: "md", className: "mt-4" })}
            onClick={() => {
              void dashboardQuery.refetch();
            }}
          >
            Try again
          </button>
        </Card>
      </section>
    );
  }

  const status = statusTag(summary);

  return (
    <section className="space-y-4 pb-2">
      <Card padding="sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Main</p>
            <h2 className="text-xl font-semibold">Attendance Progress</h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.text}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              syncMutation.reset();
              syncMutation.mutate();
            }}
            disabled={isRefreshing || syncMutation.isPending}
            className={buttonClass({ variant: "primary", size: "sm" })}
          >
            {syncMutation.isPending ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        <StaleDataBanner
          isStale={summary.isStale}
          staleAgeHours={summary.staleAgeHours}
          lastSyncedAt={summary.lastSyncedAt}
          syncStatus={summary.syncStatus}
          syncStartedAt={summary.syncStartedAt}
          syncFinishedAt={summary.syncFinishedAt}
        />

        {syncMutation.data ? (
          <Banner tone="success" className="mt-3">
            {syncSuccessText(syncMutation.data)}
          </Banner>
        ) : null}

        {syncMutation.error ? (
          <Banner tone="danger" className="mt-3">
            {errorText(syncMutation.error)}
          </Banner>
        ) : null}

        {summary.todayIsLive ? (
          <Banner tone="success" className="mt-3">
            Today includes a campus session that was still open at the last sync
            {summary.liveCheckedAt ? ` (${shortDateTime(summary.liveCheckedAt)})` : ""}. Progress is
            provisional until the session closes and you sync again.
          </Banner>
        ) : null}

        <div className="mt-4">
          <ConcentricProgressRings
            metrics={ringMetrics}
            centerValue={progressPercent(summary.hoursMonth, summary.monthlyGoalHours)}
          />
        </div>
      </Card>

      {displayError && (
        <Banner tone="danger">
          {errorText(displayError)}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Today"
          value={hoursToReadable(summary.hoursToday)}
          subtitle={
            summary.todayIsLive
              ? `Live now • finalized ${hoursToReadable(summary.hoursTodayFinalized)}`
              : `Goal ${hoursToReadable(summary.dailyGoalHours)}`
          }
        />
        <MetricCard
          title="This Week"
          value={hoursToReadable(summary.hoursWeek)}
          subtitle={`Goal ${hoursToReadable(summary.weeklyGoalHours)}`}
        />
        <MetricCard
          title="Hours Left"
          value={hoursToReadable(Math.max(summary.hoursLeftToMonthlyGoal, 0))}
          subtitle={`Month goal ${hoursToReadable(summary.monthlyGoalHours)}`}
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
          monthKey={currentMonthKey}
          dailyGoalHours={summary.dailyGoalHours}
          weeklyGoalHours={summary.weeklyGoalHours}
          days={monthHistory.days}
        />
      ) : (
        <Card>
          <h3 className="text-lg font-semibold">Monthly Attendance Calendar</h3>
          <p className="mt-2 text-sm text-tt42-muted">{monthHistoryQuery.isPending ? "Loading..." : "Unavailable."}</p>
        </Card>
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
    <Card padding="sm">
      <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Snapshot</p>
      <h3 className="mt-1 text-lg font-semibold">Current Month</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-tt42-muted sm:grid-cols-2">
        <p>Coverage: {coverage}</p>
        <p>Total hours: {hoursToReadable(monthHistory?.totalHours ?? summary.hoursMonth)}</p>
        <p>Days in range: {monthHistory?.totalDays ?? 0}</p>
        <p>Pace mode: {useWeekdaysPaceMode(summary.paceMode) ? "Weekdays" : "All days"}</p>
      </div>
    </Card>
  );
}
