import { describe, expect, it } from "vitest";

import { comparisonRanges } from "./comparison";

describe("comparisonRanges", () => {
  it("compares the same weekday span of the previous week (Wed 14 Oct)", () => {
    const ranges = comparisonRanges("2026-10-14");

    expect(ranges.weekStart).toBe("2026-10-12");
    expect(ranges.previousWeekStart).toBe("2026-10-05");
    expect(ranges.previousWeekThroughSamePoint).toBe("2026-10-07"); // Mon-Wed vs Mon-Wed
  });

  it("covers the whole previous week on a Sunday", () => {
    const ranges = comparisonRanges("2026-10-18");

    expect(ranges.weekStart).toBe("2026-10-12");
    expect(ranges.previousWeekThroughSamePoint).toBe("2026-10-11");
  });

  it("is just the first day on a Monday", () => {
    const ranges = comparisonRanges("2026-10-12");

    expect(ranges.previousWeekStart).toBe("2026-10-05");
    expect(ranges.previousWeekThroughSamePoint).toBe("2026-10-05");
  });

  it("compares day 14 of this month with day 14 of last month", () => {
    const ranges = comparisonRanges("2026-10-14");

    expect(ranges.monthStart).toBe("2026-10-01");
    expect(ranges.previousMonthStart).toBe("2026-09-01");
    expect(ranges.previousMonthThroughSamePoint).toBe("2026-09-14");
  });

  it("clamps to the end of a shorter previous month (31 Mar vs February)", () => {
    expect(comparisonRanges("2026-03-31").previousMonthThroughSamePoint).toBe("2026-02-28");
    expect(comparisonRanges("2028-03-31").previousMonthThroughSamePoint).toBe("2028-02-29");
  });

  it("handles the year boundary", () => {
    const ranges = comparisonRanges("2027-01-10");

    expect(ranges.previousMonthStart).toBe("2026-12-01");
    expect(ranges.previousMonthThroughSamePoint).toBe("2026-12-10");
  });
});
