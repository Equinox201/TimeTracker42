import { useMutation, useQuery } from "@tanstack/react-query";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { AttendanceMonthCalendar } from "../components/main/AttendanceMonthCalendar";
import { StaleDataBanner } from "../components/main/StaleDataBanner";
import {
  getAttendanceHistory,
  getDashboardSummary,
  triggerManualSync,
  type AttendanceHistoryDay
} from "../lib/api/dashboardApi";
import { ApiError } from "../lib/api/http";
import { useAuth } from "../lib/auth";
import { hoursToReadable, monthYearLabel } from "../lib/formatters";

type MonthlyPoint = {
  monthDate: Date;
  monthKey: string;
  monthShort: string;
  monthLong: string;
  hours: number;
};

type ChartRow = {
  monthKey: string;
  monthShort: string;
  monthLong: string;
  hours: number;
};

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

function buildMonthlyPoints(days: AttendanceHistoryDay[], fromDate: Date, toDate: Date): MonthlyPoint[] {
  const totals = new Map<string, number>();

  for (const day of days) {
    const parsed = parseISO(day.day);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const key = monthKey(startOfMonth(parsed));
    totals.set(key, (totals.get(key) ?? 0) + day.hours);
  }

  return eachMonthOfInterval({ start: startOfMonth(fromDate), end: startOfMonth(toDate) }).map((date) => {
    const key = monthKey(date);
    return {
      monthDate: date,
      monthKey: key,
      monthShort: format(date, "MMM"),
      monthLong: monthYearLabel(date),
      hours: totals.get(key) ?? 0
    };
  });
}

function filterToMonth(days: AttendanceHistoryDay[], selectedMonth: Date): AttendanceHistoryDay[] {
  return days.filter((day) => {
    const parsed = parseISO(day.day);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }
    return isSameMonth(parsed, selectedMonth);
  });
}

function countAchievedWeeks(days: AttendanceHistoryDay[], weeklyGoalHours: number): number {
  if (weeklyGoalHours <= 0 || days.length === 0) {
    return 0;
  }

  const weeklyTotals = new Map<string, number>();
  for (const day of days) {
    const parsed = parseISO(day.day);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const start = startOfWeek(parsed, { weekStartsOn: 1 });
    const key = monthKey(start) + `-${format(start, "dd")}`;
    weeklyTotals.set(key, (weeklyTotals.get(key) ?? 0) + day.hours);
  }

  return Array.from(weeklyTotals.values()).filter((value) => value >= weeklyGoalHours).length;
}

export function HistoryPage() {
  const { validAccessToken, signOut } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

  const currentMonth = startOfMonth(new Date());
  const rangeStartDate = startOfMonth(subMonths(currentMonth, 5));
  const rangeEndDate = endOfMonth(currentMonth);
  const rangeStart = format(rangeStartDate, "yyyy-MM-dd");
  const rangeEnd = format(rangeEndDate, "yyyy-MM-dd");

  const historyQuery = useQuery({
    queryKey: ["attendance-history-range", rangeStart, rangeEnd],
    queryFn: async () => {
      const accessToken = await validAccessToken();
      try {
        return await getAttendanceHistory(accessToken, {
          from: rangeStart,
          to: rangeEnd
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await signOut();
        }
        throw error;
      }
    }
  });

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
      await Promise.all([historyQuery.refetch(), dashboardQuery.refetch()]);
    }
  });

  const history = historyQuery.data ?? null;
  const monthlyPoints = useMemo(() => {
    if (!history) {
      return [];
    }
    return buildMonthlyPoints(history.days, rangeStartDate, rangeEndDate);
  }, [history, rangeEndDate, rangeStartDate]);

  useEffect(() => {
    if (monthlyPoints.length === 0) {
      return;
    }

    const hasSelected = monthlyPoints.some((point) => isSameMonth(point.monthDate, selectedMonth));
    if (!hasSelected) {
      setSelectedMonth(monthlyPoints[monthlyPoints.length - 1].monthDate);
    }
  }, [monthlyPoints, selectedMonth]);

  const selectedMonthDays = history ? filterToMonth(history.days, selectedMonth) : [];
  const dailyGoal = dashboardQuery.data?.dailyGoalHours ?? 6;
  const weeklyGoal = dashboardQuery.data?.weeklyGoalHours ?? 22.5;

  const chartRows: ChartRow[] = monthlyPoints.map((point) => ({
    monthKey: point.monthKey,
    monthShort: point.monthShort,
    monthLong: point.monthLong,
    hours: Number(point.hours.toFixed(2))
  }));

  const totalRangeHours = monthlyPoints.reduce((sum, point) => sum + point.hours, 0);
  const averageRangeHours = monthlyPoints.length > 0 ? totalRangeHours / monthlyPoints.length : 0;
  const bestMonth = monthlyPoints.reduce<MonthlyPoint | null>((best, point) => {
    if (!best || point.hours > best.hours) {
      return point;
    }
    return best;
  }, null);

  const selectedMonthHours = selectedMonthDays.reduce((sum, day) => sum + day.hours, 0);
  const selectedMonthRecordedDays = selectedMonthDays.filter((day) => day.hasRecord).length;
  const selectedMonthGoalDays = dailyGoal > 0
    ? selectedMonthDays.filter((day) => day.hours >= dailyGoal).length
    : 0;
  const selectedMonthWeekHits = countAchievedWeeks(selectedMonthDays, weeklyGoal);

  const isFetching = historyQuery.isFetching || dashboardQuery.isFetching;
  const pageError = historyQuery.error ?? dashboardQuery.error ?? syncMutation.error ?? null;

  if (historyQuery.isPending) {
    return (
      <section className="space-y-4 pb-2">
        <div className="h-56 animate-pulse rounded-card border border-tt42-border bg-tt42-surface2" />
        <div className="h-40 animate-pulse rounded-card border border-tt42-border bg-tt42-surface2" />
      </section>
    );
  }

  if (!history) {
    return (
      <section className="space-y-4 pb-2">
        <article className="rounded-card border border-tt42-danger/40 bg-tt42-danger/10 p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Unable to load historic data</h2>
          <p className="mt-2 text-sm text-tt42-muted">{errorText(pageError)}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-tt42-border bg-tt42-surface px-3 py-2 text-sm"
            onClick={() => {
              void historyQuery.refetch();
            }}
          >
            Try again
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-2">
      <article className="rounded-card border border-tt42-border bg-gradient-to-b from-tt42-surface2/70 to-tt42-surface p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">History</p>
            <h2 className="text-xl font-semibold">Historic Attendance</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void Promise.all([historyQuery.refetch(), dashboardQuery.refetch()]);
              }}
              disabled={isFetching || syncMutation.isPending}
              className="rounded-lg border border-tt42-border bg-tt42-surface px-3 py-2 text-xs font-medium text-tt42-text disabled:opacity-60"
            >
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                syncMutation.reset();
                syncMutation.mutate();
              }}
              disabled={isFetching || syncMutation.isPending}
              className="rounded-lg border border-tt42-magenta/40 bg-tt42-magenta/15 px-3 py-2 text-xs font-medium text-tt42-text disabled:opacity-60"
            >
              {syncMutation.isPending ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        <StaleDataBanner
          isStale={history.isStale}
          staleAgeHours={history.staleAgeHours}
          lastSyncedAt={history.lastSyncedAt}
        />
      </article>

      {pageError && (
        <article className="rounded-xl border border-tt42-danger/40 bg-tt42-danger/10 px-3 py-2 text-sm text-tt42-text">
          {errorText(pageError)}
        </article>
      )}

      <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Monthly Totals</p>
            <h3 className="text-lg font-semibold text-tt42-text">Last 6 Months</h3>
          </div>
        </header>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tt42HistoryBars" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--tt42-teal)" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="var(--tt42-mint)" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tt42-border)" strokeOpacity={0.35} vertical={false} />
              <XAxis dataKey="monthShort" tick={{ fill: "var(--tt42-text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "var(--tt42-text-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip
                cursor={{ fill: "rgba(17, 167, 196, 0.08)" }}
                contentStyle={{
                  background: "var(--tt42-surface)",
                  border: "1px solid var(--tt42-border)",
                  borderRadius: "12px"
                }}
                formatter={(value: number) => hoursToReadable(value)}
                labelFormatter={(_, payload) => payload[0]?.payload?.monthLong ?? ""}
              />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]} fill="url(#tt42HistoryBars)">
                {chartRows.map((row) => (
                  <Cell
                    key={row.monthKey}
                    fill={isSameMonth(parseISO(`${row.monthKey}-01`), selectedMonth) ? "var(--tt42-magenta)" : "url(#tt42HistoryBars)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
        <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Range Summary</p>
        <h3 className="mt-1 text-lg font-semibold text-tt42-text">
          {monthlyPoints[0] ? monthlyPoints[0].monthLong : "-"}
          {monthlyPoints[monthlyPoints.length - 1] ? ` to ${monthlyPoints[monthlyPoints.length - 1].monthLong}` : ""}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-tt42-muted sm:grid-cols-2">
          <p>Total hours: {hoursToReadable(totalRangeHours)}</p>
          <p>Average / month: {hoursToReadable(averageRangeHours)}</p>
          <p>Months in chart: {monthlyPoints.length}</p>
          <p>
            Best month: {bestMonth ? `${bestMonth.monthLong} (${hoursToReadable(bestMonth.hours)})` : "-"}
          </p>
        </div>
      </article>

      <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
        <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Month Selection</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {monthlyPoints.map((point) => {
            const active = isSameMonth(point.monthDate, selectedMonth);
            return (
              <button
                key={point.monthKey}
                type="button"
                onClick={() => setSelectedMonth(point.monthDate)}
                className={[
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                  active
                    ? "border-tt42-magenta/60 bg-tt42-magenta/15 text-tt42-text"
                    : "border-tt42-border bg-tt42-surface2 text-tt42-muted"
                ].join(" ")}
              >
                {point.monthShort}
              </button>
            );
          })}
        </div>
      </article>

      <AttendanceMonthCalendar
        month={selectedMonth}
        dailyGoalHours={dailyGoal}
        weeklyGoalHours={weeklyGoal}
        days={selectedMonthDays}
      />

      <article className="rounded-card border border-tt42-border bg-tt42-surface p-4 shadow-soft">
        <p className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Month Summary</p>
        <h3 className="mt-1 text-lg font-semibold text-tt42-text">{monthYearLabel(selectedMonth)}</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-tt42-muted sm:grid-cols-2">
          <p>Total hours: {hoursToReadable(selectedMonthHours)}</p>
          <p>Recorded days: {selectedMonthRecordedDays}</p>
          <p>Goal-achieved days: {selectedMonthGoalDays}</p>
          <p>Weekly goals hit: {selectedMonthWeekHits}</p>
        </div>
      </article>
    </section>
  );
}
