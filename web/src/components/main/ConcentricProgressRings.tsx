import { hoursToCompact, hoursToReadable } from "../../lib/formatters";

const SIZE = 320;
const CENTER = SIZE / 2;
const STROKE_WIDTH = 24;
const RADII = [128, 96, 64];
const RING_GAP = RADII[0] - RADII[1] - STROKE_WIDTH;
const INNER_RING_INNER_RADIUS = RADII[RADII.length - 1] - STROKE_WIDTH / 2;
const CENTER_DISK_SIZE = (INNER_RING_INNER_RADIUS - RING_GAP) * 2;

// One accent: the three rings differ by intensity (outermost strongest).
type RingTone = "strong" | "medium" | "soft";

export type RingMetric = {
  id: string;
  label: string;
  valueHours: number;
  goalHours: number;
  tone: RingTone;
};

type ConcentricProgressRingsProps = {
  metrics: RingMetric[];
  centerValue: string;
};

const toneColor = "var(--tt42-accent)";
const opacityByTone: Record<RingTone, number> = {
  strong: 1,
  medium: 0.62,
  soft: 0.38
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function arcDashArray(radius: number, ratio: number): string {
  const circumference = 2 * Math.PI * radius;
  const safeRatio = clamp(ratio, 0.0001, 0.9995);
  const dash = circumference * safeRatio;
  const gap = Math.max(circumference - dash, 0.0001);
  return `${dash} ${gap}`;
}

function headPoint(radius: number, ratio: number): { x: number; y: number } {
  const turns = ratio % 1;
  const normalized = turns === 0 && ratio > 0 ? 1 : turns;
  const angle = (normalized * 360 - 90) * (Math.PI / 180);
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle)
  };
}

export function ConcentricProgressRings({ metrics, centerValue }: ConcentricProgressRingsProps) {
  return (
    <div className="rounded-3xl bg-tt42-surface2/60 p-4">
      <div className="relative mx-auto aspect-square w-full max-w-[340px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          {metrics.slice(0, 3).map((metric, index) => {
            const radius = RADII[index] ?? RADII[RADII.length - 1];
            const circumference = 2 * Math.PI * radius;
            const goal = metric.goalHours > 0 ? metric.goalHours : 1;
            const progress = metric.goalHours <= 0 ? (metric.valueHours > 0 ? 1 : 0) : Math.max(metric.valueHours / goal, 0);
            const baseRatio = Math.min(progress, 1);
            const overflow = Math.max(progress - 1, 0);
            const overflowWholeLaps = Math.floor(overflow);
            const overflowPartial = overflow - overflowWholeLaps;
            const toneOpacity = opacityByTone[metric.tone];
            const dot = headPoint(radius, progress);

            return (
              <g key={metric.id}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke="var(--tt42-surface-2)"
                  strokeWidth={STROKE_WIDTH}
                />

                {progress > 0 && (
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={radius}
                    fill="none"
                    stroke={toneColor}
                    strokeOpacity={toneOpacity}
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={arcDashArray(radius, baseRatio)}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  />
                )}

                {overflowWholeLaps > 0 &&
                  Array.from({ length: overflowWholeLaps }).map((_, lapIndex) => (
                    <circle
                      key={`${metric.id}-overflow-${lapIndex}`}
                      cx={CENTER}
                      cy={CENTER}
                      r={radius}
                      fill="none"
                      stroke={toneColor}
                      strokeWidth={STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeDasharray={`${circumference * 0.998} ${circumference}`}
                      transform={`rotate(-90 ${CENTER} ${CENTER})`}
                      opacity={0.38 * toneOpacity}
                    />
                  ))}

                {overflowPartial > 0 && (
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={radius}
                    fill="none"
                    stroke={toneColor}
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={arcDashArray(radius, overflowPartial)}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                    opacity={0.7 * toneOpacity}
                  />
                )}

                {progress > 0 && (
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={STROKE_WIDTH * 0.34}
                    fill="var(--tt42-surface)"
                    stroke={toneColor}
                    strokeOpacity={toneOpacity}
                    strokeWidth="3"
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center rounded-full bg-tt42-surface text-center"
            style={{ width: CENTER_DISK_SIZE, height: CENTER_DISK_SIZE }}
          >
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-tt42-text">{centerValue}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.slice(0, 3).map((metric) => {
          const target = metric.goalHours > 0 ? metric.goalHours : 0;
          return (
            <div key={`${metric.id}-summary`} className="rounded-xl bg-tt42-surface px-3 py-2">
              <p className="text-xs font-medium text-tt42-muted">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-tt42-text">{hoursToReadable(metric.valueHours)}</p>
              <p className="text-[11px] text-tt42-muted">Goal {hoursToCompact(target)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
