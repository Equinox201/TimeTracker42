import { describe, expect, it } from "vitest";

import {
  addSingaporeDaysKey,
  addSingaporeMonthsKey,
  countRemainingSingaporeDays,
  countSingaporeDaysInclusive,
  eachSingaporeMonthKey,
  endOfSingaporeMonthKey,
  isSingaporeWeekdayKey,
  singaporeDayKey,
  singaporeDayOfMonthLabel,
  singaporeHistoryRangeKeys,
  singaporeMonthKey,
  singaporeWeekStartKeyFromDayKey,
  startOfSingaporeMonthKey,
  startOfSingaporeWeekKey
} from "./singaporeDate";

describe("singaporeDayKey", () => {
  it("stays on the same day just before midnight Singapore time", () => {
    // 23:59:59 SGT
    expect(singaporeDayKey(new Date("2026-10-14T15:59:59Z"))).toBe("2026-10-14");
  });

  it("rolls to the next day at 00:00 Singapore time (16:00 UTC)", () => {
    expect(singaporeDayKey(new Date("2026-10-14T16:00:00Z"))).toBe("2026-10-15");
  });

  it("rolls the month and year across the boundary", () => {
    expect(singaporeMonthKey(new Date("2026-01-31T16:00:00Z"))).toBe("2026-02");
    expect(singaporeDayKey(new Date("2026-12-31T16:30:00Z"))).toBe("2027-01-01");
  });
});

describe("month boundaries", () => {
  it("returns first and last day of the Singapore month", () => {
    const date = new Date("2026-10-14T00:00:00Z");
    expect(startOfSingaporeMonthKey(date)).toBe("2026-10-01");
    expect(endOfSingaporeMonthKey(date)).toBe("2026-10-31");
  });

  it("handles February in common and leap years", () => {
    expect(endOfSingaporeMonthKey(new Date("2026-02-10T00:00:00Z"))).toBe("2026-02-28");
    expect(endOfSingaporeMonthKey(new Date("2028-02-10T00:00:00Z"))).toBe("2028-02-29");
  });

  it("uses the Singapore month when UTC is still in the previous month", () => {
    // 2026-09-30 17:00 UTC is already 2026-10-01 in Singapore.
    expect(startOfSingaporeMonthKey(new Date("2026-09-30T17:00:00Z"))).toBe("2026-10-01");
  });
});

describe("week handling (weeks start on Monday)", () => {
  it("finds Monday for any weekday", () => {
    expect(singaporeWeekStartKeyFromDayKey("2026-10-12")).toBe("2026-10-12");
    expect(singaporeWeekStartKeyFromDayKey("2026-10-14")).toBe("2026-10-12");
    expect(singaporeWeekStartKeyFromDayKey("2026-10-18")).toBe("2026-10-12");
  });

  it("derives the week start from an instant in Singapore time", () => {
    // Sunday 2026-10-18 16:00 UTC is Monday 2026-10-19 in Singapore.
    expect(startOfSingaporeWeekKey(new Date("2026-10-18T16:00:00Z"))).toBe("2026-10-19");
  });

  it("identifies weekdays", () => {
    expect(isSingaporeWeekdayKey("2026-10-16")).toBe(true);
    expect(isSingaporeWeekdayKey("2026-10-17")).toBe(false);
    expect(isSingaporeWeekdayKey("2026-10-18")).toBe(false);
  });
});

describe("key arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addSingaporeDaysKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(addSingaporeDaysKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("adds months across year boundaries", () => {
    expect(addSingaporeMonthsKey("2026-01", -1)).toBe("2025-12");
    expect(addSingaporeMonthsKey("2026-11", 3)).toBe("2027-02");
  });

  it("builds a six-month history range ending at the current month end", () => {
    expect(singaporeHistoryRangeKeys(6, new Date("2026-10-14T00:00:00Z"))).toEqual({
      start: "2026-05-01",
      end: "2026-10-31"
    });
  });

  it("never returns an empty history range", () => {
    expect(singaporeHistoryRangeKeys(0, new Date("2026-10-14T00:00:00Z")).start).toBe("2026-10-01");
  });

  it("lists every month key between two days", () => {
    expect(eachSingaporeMonthKey("2026-11-15", "2027-02-03")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02"
    ]);
  });
});

describe("day counting", () => {
  it("counts days inclusively", () => {
    expect(countSingaporeDaysInclusive("2026-10-01", "2026-10-31")).toBe(31);
    expect(countSingaporeDaysInclusive("2026-10-14", "2026-10-14")).toBe(1);
  });

  it("returns 0 for reversed or invalid ranges", () => {
    expect(countSingaporeDaysInclusive("2026-10-15", "2026-10-14")).toBe(0);
    expect(countSingaporeDaysInclusive("not-a-date", "2026-10-14")).toBe(0);
  });

  it("counts remaining weekdays or calendar days, never less than one", () => {
    expect(countRemainingSingaporeDays("2026-10-14", "2026-10-18", true)).toBe(3);
    expect(countRemainingSingaporeDays("2026-10-14", "2026-10-18", false)).toBe(5);
    expect(countRemainingSingaporeDays("2026-10-19", "2026-10-18", true)).toBe(1);
  });

  it("labels the day of month without a leading zero", () => {
    expect(singaporeDayOfMonthLabel("2026-10-05")).toBe("5");
  });
});
