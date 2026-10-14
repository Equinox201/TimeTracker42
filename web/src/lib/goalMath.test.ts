import { describe, expect, it } from "vitest";

import {
  buildRecommendedPace,
  countActiveDaysInMonth,
  countRemainingTargetDays,
  deriveGoalDraft,
  formatGoalInput
} from "./goalMath";

// October 2026 starts on a Thursday: 31 calendar days, 22 weekdays.
const october = (day: number) => new Date(2026, 9, day);

describe("countActiveDaysInMonth", () => {
  it("counts calendar days or weekdays", () => {
    expect(countActiveDaysInMonth(october(15), "calendar_days")).toBe(31);
    expect(countActiveDaysInMonth(october(15), "weekdays")).toBe(22);
  });

  it("handles February in a common year", () => {
    expect(countActiveDaysInMonth(new Date(2026, 1, 10), "calendar_days")).toBe(28);
    expect(countActiveDaysInMonth(new Date(2026, 1, 10), "weekdays")).toBe(20);
  });
});

describe("deriveGoalDraft", () => {
  const base = { paceMode: "weekdays" as const, daysPerWeek: 5, effectiveFrom: october(1) };

  it("derives daily and weekly from a monthly goal", () => {
    const draft = deriveGoalDraft({ ...base, inputMode: "monthly", inputGoalHours: 110 });
    expect(draft.monthlyGoalHours).toBe(110);
    expect(draft.dailyGoalHours).toBe(5);
    expect(draft.weeklyGoalHours).toBe(25);
  });

  it("derives weekly and monthly from a daily goal", () => {
    const draft = deriveGoalDraft({ ...base, inputMode: "daily", inputGoalHours: 5 });
    expect(draft.weeklyGoalHours).toBe(25);
    expect(draft.monthlyGoalHours).toBe(110);
  });

  it("derives daily and monthly from a weekly goal", () => {
    const draft = deriveGoalDraft({ ...base, inputMode: "weekly", inputGoalHours: 25 });
    expect(draft.dailyGoalHours).toBe(5);
    expect(draft.monthlyGoalHours).toBe(110);
  });

  it("clamps days per week to 1..7", () => {
    expect(deriveGoalDraft({ ...base, daysPerWeek: 10, inputMode: "daily", inputGoalHours: 1 }).daysPerWeek).toBe(7);
    expect(deriveGoalDraft({ ...base, daysPerWeek: 0, inputMode: "daily", inputGoalHours: 1 }).daysPerWeek).toBe(1);
  });

  it("treats negative or non-finite input as zero", () => {
    const draft = deriveGoalDraft({ ...base, inputMode: "daily", inputGoalHours: Number.NaN });
    expect(draft.dailyGoalHours).toBe(0);
    expect(draft.monthlyGoalHours).toBe(0);
  });
});

describe("countRemainingTargetDays", () => {
  it("includes today through the end of the month", () => {
    expect(countRemainingTargetDays(october(14), "calendar_days")).toBe(18);
    expect(countRemainingTargetDays(october(14), "weekdays")).toBe(13);
  });

  it("never returns zero (31 Oct 2026 is a Saturday)", () => {
    expect(countRemainingTargetDays(october(31), "weekdays")).toBe(1);
  });
});

describe("buildRecommendedPace", () => {
  it("spreads the remaining hours over the remaining weekdays", () => {
    const pace = buildRecommendedPace({
      monthlyGoalHours: 110,
      monthlyHoursSoFar: 50,
      paceMode: "weekdays",
      daysPerWeek: 5,
      fromDate: october(14)
    });

    expect(pace.remainingHours).toBe(60);
    expect(pace.targetDays).toBe(13);
    expect(pace.recDaily).toBe(4.62);
    expect(pace.recWeekly).toBe(23.08);
  });

  it("recommends nothing once the goal is reached", () => {
    const pace = buildRecommendedPace({
      monthlyGoalHours: 110,
      monthlyHoursSoFar: 120,
      paceMode: "weekdays",
      daysPerWeek: 5,
      fromDate: october(14)
    });

    expect(pace.remainingHours).toBe(0);
    expect(pace.recDaily).toBe(0);
  });
});

describe("formatGoalInput", () => {
  it("drops trailing zeros and guards bad input", () => {
    expect(formatGoalInput(3)).toBe("3");
    expect(formatGoalInput(2.5)).toBe("2.5");
    expect(formatGoalInput(-1)).toBe("0");
    expect(formatGoalInput(Number.NaN)).toBe("0");
  });
});
