import { describe, expect, it } from "vitest";

import { buildCumulativeSeries } from "./cumulative";

const base = {
  monthKey: "2026-10",
  todayKey: "2026-10-14",
  monthlyGoalHours: 110,
  weekdaysOnly: true
};

describe("buildCumulativeSeries", () => {
  const series = buildCumulativeSeries({
    ...base,
    hoursByDay: { "2026-10-01": 6, "2026-10-02": 4, "2026-10-05": 5, "2026-10-14": 3.5 }
  });

  it("has one point per day of the month", () => {
    expect(series).toHaveLength(31);
    expect(series[0]).toMatchObject({ day: "2026-10-01", dayOfMonth: 1 });
    expect(series[30]).toMatchObject({ day: "2026-10-31", dayOfMonth: 31 });
  });

  it("accumulates attended hours and carries them over empty days", () => {
    expect(series[0].actual).toBe(6);
    expect(series[1].actual).toBe(10);
    expect(series[2].actual).toBe(10); // Sat 3 Oct, nothing attended
    expect(series[4].actual).toBe(15);
    expect(series[13].actual).toBe(18.5);
  });

  it("leaves the future empty so the line stops at today", () => {
    expect(series[13].actual).not.toBeNull();
    expect(series[14].actual).toBeNull();
    expect(series[30].actual).toBeNull();
  });

  it("shows the straight-line pace across the whole month, ending at the goal", () => {
    expect(series[0].expected).toBe(5);
    expect(series[13].expected).toBe(50);
    expect(series[30].expected).toBe(110);
  });

  it("is empty-safe when nothing was attended", () => {
    const empty = buildCumulativeSeries({ ...base, hoursByDay: {} });
    expect(empty.filter((point) => point.actual !== null).every((point) => point.actual === 0)).toBe(true);
  });
});
