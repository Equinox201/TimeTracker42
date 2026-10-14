import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { AttendanceMonthCalendar } from "../components/main/AttendanceMonthCalendar";
import { PaceHero } from "../components/main/PaceHero";
import { StaleDataBanner } from "../components/main/StaleDataBanner";
import { Banner } from "../components/ui/Banner";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { MiniRing } from "../components/ui/MiniRing";
import { Skeleton } from "../components/ui/Skeleton";
import { Stat } from "../components/ui/Stat";
import {
  getAttendanceHistory,
  getDashboardSummary,
  triggerManualSync,
  type AttendanceHistory,
  type DashboardSummary
} from "../lib/api/dashboardApi";
import { useAuth } from "../lib/auth";
import { buildCumulativeSeries } from "../lib/cumulative";
import { hoursToReadable, shortDateTime } from "../lib/formatters";
import { computePace } from "../lib/pace";
import {
  endOfSingaporeMonthKey,
  singaporeDayKey,
  singaporeMonthKey,
  singaporeMonthLongLabel,
  startOfSingaporeMonthKey
} from "../lib/singaporeDate";

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

function useWeekdaysPaceMode(mode: string): boolean {
  return mode.toLowerCase().includes("weekday");
}

function ratio(value: number, goal: number): number {
  return goal > 0 ? value / goal : 0;
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
  const todayKey = singaporeDayKey(now);
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
  const displayError = dashboardQuery.error ?? monthHistoryQuery.error ?? null;

  const weekdaysOnly = summary ? useWeekdaysPaceMode(summary.paceMode) : true;

  const pace = useMemo(
    () =>
      summary
        ? computePace({
            todayKey,
            monthlyGoalHours: summary.monthlyGoalHours,
            hoursMonth: summary.hoursMonth,
            weekdaysOnly
          })
        : null,
    [summary, todayKey, weekdaysOnly]
  );

  const series = useMemo(() => {
    if (!monthHistory) {
      return null;
    }
    const hoursByDay: Record<string, number> = {};
    for (const entry of monthHistory.days) {
      hoursByDay[entry.day] = entry.hours;
    }
    return buildCumulativeSeries({
      monthKey: currentMonthKey,
      todayKey,
      monthlyGoalHours: summary?.monthlyGoalHours ?? 0,
      weekdaysOnly,
      hoursByDay
    });
  }, [currentMonthKey, monthHistory, summary?.monthlyGoalHours, todayKey, weekdaysOnly]);

  if (dashboardQuery.isPending) {
    return (
      <section className="space-y-4 pb-2" aria-busy="true" aria-label="Loading dashboard">
        <Skeleton className="h-12" />
        <div className="grid gap-4 md:grid-cols-5">
          <Skeleton className="h-96 md:col-span-3" />
          <div className="grid grid-cols-2 gap-3 md:col-span-2 md:content-start">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        </div>
        <Skeleton className="h-80" />
      </section>
    );
  }

  if (!summary || !pace) {
    return (
      <section className="space-y-4 pb-2">
        <Card>
          <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
          <p className="mt-2 text-sm text-tt42-muted">{errorText(displayError)}</p>
          <Button
            className="mt-4"
            onClick={() => {
              void dashboardQuery.refetch();
            }}
          >
            Try again
          </Button>
        </Card>
      </section>
    );
  }

  const requiredPace = weekdaysOnly ? summary.requiredHoursPerRemainingWeekday : summary.requiredHoursPerRemainingDay;

  const notes: string[] = [];
  if (summary.todayIsLive) {
    notes.push(
      `Today includes a campus session that was still open at the last sync${
        summary.liveCheckedAt ? ` (${shortDateTime(summary.liveCheckedAt)})` : ""
      }. Progress is provisional until it closes and you sync again.`
    );
  }
  if (syncMutation.data) {
    notes.push(syncSuccessText(syncMutation.data));
  }

  return (
    <section className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-tt42-muted">{singaporeMonthLongLabel(currentMonthKey)}</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            syncMutation.reset();
            syncMutation.mutate();
          }}
          disabled={isRefreshing || syncMutation.isPending}
        >
          {syncMutation.isPending ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      <StaleDataBanner
        isStale={summary.isStale}
        staleAgeHours={summary.staleAgeHours}
        lastSyncedAt={summary.lastSyncedAt}
        syncStatus={summary.syncStatus}
        syncStartedAt={summary.syncStartedAt}
        syncFinishedAt={summary.syncFinishedAt}
        notes={notes}
      />

      {syncMutation.error ? <Banner tone="danger">{errorText(syncMutation.error)}</Banner> : null}
      {displayError ? <Banner tone="danger">{errorText(displayError)}</Banner> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <PaceHero
            hoursMonth={summary.hoursMonth}
            goalHours={summary.monthlyGoalHours}
            pace={pace}
            series={series}
            weekDeltaHours={summary.weekVsPreviousWeekHours}
            monthDeltaHours={summary.monthVsPreviousMonthHours}
          />
        </Card>

        <div className="grid grid-cols-2 gap-3 md:col-span-2 md:content-start">
          <Stat
            label="Today"
            value={hoursToReadable(summary.hoursToday)}
            hint={`Goal ${hoursToReadable(summary.dailyGoalHours)}`}
            trailing={<MiniRing ratio={ratio(summary.hoursToday, summary.dailyGoalHours)} label="Today" />}
          />
          <Stat
            label="This week"
            value={hoursToReadable(summary.hoursWeek)}
            hint={`Goal ${hoursToReadable(summary.weeklyGoalHours)}`}
            trailing={<MiniRing ratio={ratio(summary.hoursWeek, summary.weeklyGoalHours)} label="This week" />}
          />
          <Stat
            label="Hours left"
            value={hoursToReadable(Math.max(summary.hoursLeftToMonthlyGoal, 0))}
            hint={`of ${hoursToReadable(summary.monthlyGoalHours)}`}
          />
          <Stat
            label="Needed per day"
            value={`${hoursToReadable(requiredPace)}`}
            hint={weekdaysOnly ? "Weekdays only" : "Every day"}
          />
        </div>
      </div>

      {monthHistory ? (
        <MonthCalendar monthHistory={monthHistory} summary={summary} monthKey={currentMonthKey} month={now} />
      ) : (
        <Card>
          <h3 className="text-lg font-semibold">Monthly attendance</h3>
          <p className="mt-2 text-sm text-tt42-muted">{monthHistoryQuery.isPending ? "Loading..." : "Unavailable."}</p>
        </Card>
      )}
    </section>
  );
}

function MonthCalendar({
  monthHistory,
  summary,
  monthKey,
  month
}: {
  monthHistory: AttendanceHistory;
  summary: DashboardSummary;
  monthKey: string;
  month: Date;
}) {
  return (
    <AttendanceMonthCalendar
      month={month}
      monthKey={monthKey}
      dailyGoalHours={summary.dailyGoalHours}
      weeklyGoalHours={summary.weeklyGoalHours}
      days={monthHistory.days}
    />
  );
}
