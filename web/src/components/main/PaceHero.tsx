import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CumulativePoint } from "../../lib/cumulative";
import { deltaHoursReadable, hoursToReadable } from "../../lib/formatters";
import { useCountUp } from "../../lib/useCountUp";
import type { PaceResult } from "../../lib/pace";
import { Skeleton } from "../ui/Skeleton";

type PaceHeroProps = {
  hoursMonth: number;
  goalHours: number;
  pace: PaceResult;
  series: CumulativePoint[] | null; // null while the month's attendance is still loading
  weekDeltaHours: number;
  monthDeltaHours: number;
  showComparison?: boolean;
};

function statusChip(pace: PaceResult): { text: string; className: string } {
  switch (pace.status) {
    case "done":
      return { text: "Goal reached", className: "bg-tt42-accent/15 text-tt42-accent" };
    case "ahead":
      return { text: `${hoursToReadable(pace.deltaHours)} ahead of pace`, className: "bg-tt42-accent/15 text-tt42-accent" };
    case "on_pace":
      return { text: "On pace", className: "bg-tt42-accent/15 text-tt42-accent" };
    case "behind":
      return { text: `${hoursToReadable(-pace.deltaHours)} behind pace`, className: "bg-tt42-warn/15 text-tt42-warn" };
    default:
      return { text: "No monthly goal set", className: "bg-tt42-surface2 text-tt42-muted" };
  }
}

function clampPercent(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

function ChartTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: CumulativePoint }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg bg-tt42-surface px-3 py-2 text-xs shadow-float ring-1 ring-tt42-border">
      <p className="font-medium text-tt42-text">Day {point.dayOfMonth}</p>
      {point.actual !== null ? (
        <p className="tabular-nums text-tt42-accent">Attended {hoursToReadable(point.actual)}</p>
      ) : null}
      <p className="tabular-nums text-tt42-muted">Pace {hoursToReadable(point.expected)}</p>
    </div>
  );
}

export function PaceHero({
  hoursMonth,
  goalHours,
  pace,
  series,
  weekDeltaHours,
  monthDeltaHours,
  showComparison = true
}: PaceHeroProps) {
  const chip = statusChip(pace);
  const shownHours = useCountUp(hoursMonth);
  const fillPercent = clampPercent(pace.progressRatio);
  const markerPercent = clampPercent(pace.expectedRatio);
  const yMax = Math.max(goalHours, hoursMonth, 1);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-tt42-muted">This month</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-semibold leading-none tracking-tight tabular-nums text-tt42-text">
              {hoursToReadable(shownHours)}
            </span>
            <span className="text-base tabular-nums text-tt42-muted">of {hoursToReadable(goalHours)}</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${chip.className}`}>{chip.text}</span>
      </div>

      <div className="mt-6">
        <div
          className="relative h-2.5 rounded-full bg-tt42-surface2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fillPercent)}
          aria-label="Monthly goal progress"
        >
          <div
            className="h-full rounded-full bg-tt42-accent transition-[width] duration-500"
            style={{ width: `${fillPercent}%` }}
          />
          {pace.status !== "no_goal" ? (
            <div
              aria-hidden
              className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-tt42-text/70"
              style={{ left: `calc(${markerPercent}% - 1px)` }}
            />
          ) : null}
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-tt42-muted">
          <span>0h</span>
          {pace.status !== "no_goal" ? <span>Pace for today {hoursToReadable(pace.expectedHours)}</span> : <span />}
          <span>{hoursToReadable(goalHours)}</span>
        </div>
      </div>

      {series === null ? (
        <Skeleton className="mt-6 h-44 w-full" />
      ) : (
        <div className="mt-6 h-44 w-full" aria-label="Cumulative hours this month compared with pace" role="img">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="tt42PaceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tt42-accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--tt42-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dayOfMonth"
                ticks={[1, 8, 15, 22, 29]}
                tick={{ fill: "var(--tt42-text-muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, yMax]} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--tt42-border)" }} />
              <Line
                type="monotone"
                dataKey="expected"
                stroke="var(--tt42-text-muted)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="var(--tt42-accent)"
                strokeWidth={2.5}
                fill="url(#tt42PaceFill)"
                connectNulls={false}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {showComparison ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-tt42-muted">Week so far vs last week</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{deltaHoursReadable(weekDeltaHours)}</dd>
          </div>
          <div>
            <dt className="text-xs text-tt42-muted">Month so far vs last month</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{deltaHoursReadable(monthDeltaHours)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
