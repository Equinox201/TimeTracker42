import { describe, expect, it } from "vitest";

import { computePace, expectedHoursThrough, targetDaysInMonth } from "./pace";

// October 2026: 31 days, 22 weekdays (Thu 1 Oct ... Sat 31 Oct).
const base = { monthlyGoalHours: 110, weekdaysOnly: true };

describe("targetDaysInMonth", () => {
  it("counts weekdays or calendar days", () => {
    expect(targetDaysInMonth("2026-10", true)).toHaveLength(22);
    expect(targetDaysInMonth("2026-10", false)).toHaveLength(31);
  });

  it("handles February in a common and a leap year", () => {
    expect(targetDaysInMonth("2026-02", false)).toHaveLength(28);
    expect(targetDaysInMonth("2028-02", false)).toHaveLength(29);
  });
});

describe("expectedHoursThrough", () => {
  it("is linear over the target days (5h per weekday on a 110h / 22 weekday month)", () => {
    expect(expectedHoursThrough("2026-10-01", 110, true)).toBeCloseTo(5);
    expect(expectedHoursThrough("2026-10-14", 110, true)).toBeCloseTo(50); // 10 weekdays
    expect(expectedHoursThrough("2026-10-30", 110, true)).toBeCloseTo(110);
  });

  it("does not move over a weekend in weekdays mode", () => {
    expect(expectedHoursThrough("2026-10-17", 110, true)).toBeCloseTo(expectedHoursThrough("2026-10-16", 110, true));
  });

  it("grows every day in calendar mode and reaches the goal on the last day", () => {
    expect(expectedHoursThrough("2026-10-31", 110, false)).toBeCloseTo(110);
    expect(expectedHoursThrough("2026-10-17", 110, false)).toBeGreaterThan(
      expectedHoursThrough("2026-10-16", 110, false)
    );
  });

  it("is zero without a goal", () => {
    expect(expectedHoursThrough("2026-10-14", 0, true)).toBe(0);
  });
});

describe("computePace", () => {
  it("is behind when well under the line", () => {
    const pace = computePace({ ...base, todayKey: "2026-10-14", hoursMonth: 47 + 2 / 3 });

    expect(pace.status).toBe("behind");
    expect(pace.expectedHours).toBe(50);
    expect(pace.deltaHours).toBeCloseTo(-2.33, 2);
    expect(pace.targetDaysElapsed).toBe(10);
    expect(pace.targetDaysTotal).toBe(22);
  });

  it("is on pace within a small tolerance either side", () => {
    expect(computePace({ ...base, todayKey: "2026-10-14", hoursMonth: 49.6 }).status).toBe("on_pace");
    expect(computePace({ ...base, todayKey: "2026-10-14", hoursMonth: 50.4 }).status).toBe("on_pace");
  });

  it("is ahead when clearly over the line", () => {
    const pace = computePace({ ...base, todayKey: "2026-10-14", hoursMonth: 58 });
    expect(pace.status).toBe("ahead");
    expect(pace.deltaHours).toBe(8);
  });

  it("is done once the goal is reached, even early in the month", () => {
    expect(computePace({ ...base, todayKey: "2026-10-05", hoursMonth: 120 }).status).toBe("done");
  });

  it("has no pace without a goal", () => {
    const pace = computePace({ ...base, monthlyGoalHours: 0, todayKey: "2026-10-14", hoursMonth: 10 });
    expect(pace.status).toBe("no_goal");
    expect(pace.expectedHours).toBe(0);
  });

  it("reports progress and expected as shares of the goal", () => {
    const pace = computePace({ ...base, todayKey: "2026-10-14", hoursMonth: 55 });
    expect(pace.progressRatio).toBeCloseTo(0.5);
    expect(pace.expectedRatio).toBeCloseTo(50 / 110);
  });

  it("uses the Singapore month of 'today' (first day of a month starts the count over)", () => {
    // Mon 2 Nov is the first November weekday: 1 of 21 target days, so 110/21 = 5.24h is expected.
    const pace = computePace({ ...base, todayKey: "2026-11-02", hoursMonth: 10 });
    expect(pace.targetDaysElapsed).toBe(1);
    expect(pace.targetDaysTotal).toBe(21);
    expect(pace.expectedHours).toBeCloseTo(5.24, 2);
    expect(pace.status).toBe("ahead");
  });
});
