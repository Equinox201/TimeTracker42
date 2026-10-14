import { describe, expect, it } from "vitest";

import { buildPlan, distributeEvenly, nextMonthKey, toggleDay, type PlannerInput } from "./planner";

const H = 3600;

// October 2026: Thu 1 Oct ... Sat 31 Oct. Mon-Fri days from Wed 14 to Fri 30 = 13.
const base: PlannerInput = {
  todayKey: "2026-10-14",
  monthKey: "2026-10",
  targetSeconds: 110 * H,
  attendedByDay: {},
  weekdays: [1, 2, 3, 4, 5],
  extraDays: [],
  excludedDays: [],
  maxSecondsPerDay: 8 * H
};

describe("achievable plans", () => {
  it("spreads the remaining hours evenly over the chosen weekdays", () => {
    const plan = buildPlan({ ...base, targetSeconds: 52 * H, attendedByDay: { "2026-10-05": 26 * H } });

    expect(plan.attendedSeconds).toBe(26 * H);
    expect(plan.remainingSeconds).toBe(26 * H);
    expect(plan.workableDays).toHaveLength(13);
    expect(plan.feasible).toBe(true);
    expect(plan.shortfallSeconds).toBe(0);
    expect(plan.plannedDays.every((day) => day.seconds === 2 * H)).toBe(true);
    expect(plan.requiredPerDaySeconds).toBe(2 * H);
    expect(plan.suggestions).toEqual([]);
  });

  it("only plans the chosen weekdays", () => {
    const plan = buildPlan({ ...base, targetSeconds: 10 * H, weekdays: [1, 3, 5] });
    const days = plan.workableDays;

    expect(days.every((day) => [1, 3, 5].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))).toBe(true);
    expect(days[0]).toBe("2026-10-14"); // Wednesday
    expect(days).not.toContain("2026-10-15"); // Thursday
  });

  it("is feasible with nothing to plan once the target is reached", () => {
    const plan = buildPlan({ ...base, targetSeconds: 20 * H, attendedByDay: { "2026-10-02": 25 * H } });

    expect(plan.remainingSeconds).toBe(0);
    expect(plan.feasible).toBe(true);
    expect(plan.plannedDays.every((day) => day.seconds === 0)).toBe(true);
    expect(plan.suggestions).toEqual([]);
  });
});

describe("days off and extra days", () => {
  it("never plans an excluded day", () => {
    const plan = buildPlan({ ...base, targetSeconds: 26 * H, excludedDays: ["2026-10-14", "2026-10-21"] });

    expect(plan.workableDays).not.toContain("2026-10-14");
    expect(plan.workableDays).not.toContain("2026-10-21");
    expect(plan.workableDays).toHaveLength(11);
  });

  it("excluded days win over extra days", () => {
    const plan = buildPlan({
      ...base,
      weekdays: [],
      extraDays: ["2026-10-17"],
      excludedDays: ["2026-10-17"]
    });
    expect(plan.workableDays).toEqual([]);
  });

  it("includes extra days outside the chosen weekdays", () => {
    const plan = buildPlan({ ...base, extraDays: ["2026-10-17"] }); // a Saturday
    expect(plan.workableDays).toContain("2026-10-17");
  });
});

describe("today and the month window", () => {
  it("counts only what is left of today's cap", () => {
    const plan = buildPlan({
      ...base,
      targetSeconds: 30 * H,
      attendedByDay: { "2026-10-14": 5 * H },
      weekdays: [3] // only Wednesdays: 14, 21, 28
    });

    expect(plan.workableDays).toEqual(["2026-10-14", "2026-10-21", "2026-10-28"]);
    expect(plan.plannedDays[0].capacitySeconds).toBe(3 * H);
    expect(plan.capacitySeconds).toBe((3 + 8 + 8) * H);
  });

  it("ignores attendance outside the planning month and after today", () => {
    const plan = buildPlan({
      ...base,
      attendedByDay: { "2026-09-30": 9 * H, "2026-10-14": 2 * H, "2026-10-20": 9 * H }
    });
    expect(plan.attendedSeconds).toBe(2 * H);
  });

  it("plans a future month from its first day", () => {
    const plan = buildPlan({ ...base, monthKey: "2026-11", targetSeconds: 40 * H });

    expect(plan.workableDays[0]).toBe("2026-11-02"); // Monday; 1 Nov is a Sunday
    expect(plan.workableDays).toHaveLength(21);
    expect(plan.feasible).toBe(true);
  });

  it("has no days left in a past month", () => {
    const plan = buildPlan({ ...base, monthKey: "2026-09", targetSeconds: 10 * H });

    expect(plan.workableDays).toEqual([]);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfallSeconds).toBe(10 * H);
  });
});

describe("impossible plans", () => {
  const impossible: PlannerInput = {
    ...base,
    targetSeconds: 110 * H,
    attendedByDay: { "2026-10-05": 40 * H },
    maxSecondsPerDay: 4 * H
  };

  it("reports the shortfall against capacity", () => {
    const plan = buildPlan(impossible);

    expect(plan.remainingSeconds).toBe(70 * H);
    expect(plan.capacitySeconds).toBe(13 * 4 * H);
    expect(plan.feasible).toBe(false);
    expect(plan.shortfallSeconds).toBe(70 * H - 52 * H);
    expect(plan.plannedDays.every((day) => day.seconds === 4 * H)).toBe(true);
  });

  it("suggests a higher daily cap that would work", () => {
    const raise = buildPlan(impossible).suggestions.find((item) => item.kind === "raise_cap");

    // 70h over 13 days = 5.38h, rounded up to the next quarter hour.
    expect(raise).toEqual({ kind: "raise_cap", maxSecondsPerDay: 5.5 * H });
  });

  it("suggests extra days, preferring free weekdays over weekends, earliest first", () => {
    // Mon-Thu only: 10 workable days x 4h = 40h; 60h still needed -> 20h missing = 5 more days.
    const plan = buildPlan({
      ...base,
      targetSeconds: 100 * H,
      attendedByDay: { "2026-10-05": 40 * H },
      weekdays: [1, 2, 3, 4],
      maxSecondsPerDay: 4 * H
    });
    const add = plan.suggestions.find((item) => item.kind === "add_days");

    // Free Fridays (16, 23, 30) first, then the earliest weekend days (17, 18).
    expect(add).toEqual({
      kind: "add_days",
      days: ["2026-10-16", "2026-10-17", "2026-10-18", "2026-10-23", "2026-10-30"]
    });
  });

  it("suggests weekend days when every weekday is already used", () => {
    // Mon-Fri at 4h = 52h of 70h needed -> 18h missing = 5 extra days; only weekends are free.
    const add = buildPlan(impossible).suggestions.find((item) => item.kind === "add_days");
    expect(add).toEqual({
      kind: "add_days",
      days: ["2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31"]
    });
  });

  it("never suggests a day off, and drops the hint when too few days remain", () => {
    const plan = buildPlan({ ...impossible, excludedDays: ["2026-10-17"] });

    // 5 extra days are needed but only 4 weekend days are not days off.
    expect(plan.suggestions.find((item) => item.kind === "add_days")).toBeUndefined();
    expect(plan.suggestions.find((item) => item.kind === "raise_cap")).toBeDefined();
  });

  it("is rescheduled into feasibility by applying a suggestion", () => {
    const first = buildPlan(impossible);
    const add = first.suggestions.find((item) => item.kind === "add_days");
    expect(add && add.kind === "add_days").toBe(true);

    const rescheduled = buildPlan({
      ...impossible,
      extraDays: add && add.kind === "add_days" ? add.days : []
    });
    expect(rescheduled.feasible).toBe(true);
    expect(rescheduled.shortfallSeconds).toBe(0);
  });

  it("does not suggest an absurd cap", () => {
    const plan = buildPlan({ ...base, targetSeconds: 500 * H });
    expect(plan.suggestions.find((item) => item.kind === "raise_cap")).toBeUndefined();
  });
});

describe("distributeEvenly", () => {
  it("fills small caps first and shares the rest equally", () => {
    expect(distributeEvenly([1, 10, 10], 12)).toEqual([1, 5.5, 5.5]);
  });

  it("never exceeds a cap and handles an empty list", () => {
    expect(distributeEvenly([2, 2], 100)).toEqual([2, 2]);
    expect(distributeEvenly([], 5)).toEqual([]);
  });
});

describe("nextMonthKey", () => {
  it("rolls over the year", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
});

describe("toggleDay", () => {
  const selection = { weekdays: [1, 2, 3, 4, 5], extraDays: [] as string[], excludedDays: [] as string[] };

  it("turns a normal working day into a day off", () => {
    expect(toggleDay(selection, "2026-10-21")).toEqual({ extraDays: [], excludedDays: ["2026-10-21"] });
  });

  it("turns a day off back on", () => {
    const next = toggleDay({ ...selection, excludedDays: ["2026-10-21"] }, "2026-10-21");
    expect(next).toEqual({ extraDays: [], excludedDays: [] });
  });

  it("makes a weekend day an extra working day, and removes it on a second tap", () => {
    const added = toggleDay(selection, "2026-10-17"); // Saturday
    expect(added).toEqual({ extraDays: ["2026-10-17"], excludedDays: [] });

    const removed = toggleDay({ ...selection, ...added }, "2026-10-17");
    expect(removed).toEqual({ extraDays: [], excludedDays: [] });
  });

  it("keeps lists sorted and free of duplicates", () => {
    const first = toggleDay(selection, "2026-10-24");
    const second = toggleDay({ ...selection, ...first }, "2026-10-17");
    expect(second.extraDays).toEqual(["2026-10-17", "2026-10-24"]);
  });

  it("never touches the weekday pattern", () => {
    const sel = { ...selection };
    toggleDay(sel, "2026-10-21");
    expect(sel.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it("round-trips: tapping a day twice restores the original state", () => {
    const once = toggleDay(selection, "2026-10-21");
    const twice = toggleDay({ ...selection, ...once }, "2026-10-21");
    expect(twice).toEqual({ extraDays: selection.extraDays, excludedDays: selection.excludedDays });
  });

  it("a plan reacts to the toggle (a day off lowers capacity)", () => {
    const base: PlannerInput = {
      todayKey: "2026-10-14",
      monthKey: "2026-10",
      targetSeconds: 50 * 3600,
      attendedByDay: {},
      weekdays: [1, 2, 3, 4, 5],
      extraDays: [],
      excludedDays: [],
      maxSecondsPerDay: 8 * 3600
    };
    const before = buildPlan(base);
    const after = buildPlan({ ...base, ...toggleDay(selection, "2026-10-21") });

    expect(after.workableDays).not.toContain("2026-10-21");
    expect(after.workableDays.length).toBe(before.workableDays.length - 1);
  });
});
