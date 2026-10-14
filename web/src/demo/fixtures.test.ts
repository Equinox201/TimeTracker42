import { describe, expect, it } from "vitest";

import { isSingaporeWeekdayKey, singaporeDayKey } from "../lib/singaporeDate";
import {
  buildDemoAttendance,
  buildDemoDeadlines,
  buildDemoGoal,
  buildDemoSyncRuns,
  demoHistoryStartKey
} from "./fixtures";

const NOW = new Date("2026-10-14T06:00:00Z"); // Wednesday, 14:00 in Singapore
const SYNCED_AT = "2026-10-14T05:35:00.000Z";

describe("buildDemoAttendance", () => {
  const rows = buildDemoAttendance(NOW, SYNCED_AT);

  it("covers six months ending today and never looks into the future", () => {
    expect(demoHistoryStartKey(NOW)).toBe("2026-05-01");
    expect(rows[0].day >= "2026-05-01").toBe(true);
    expect(rows[rows.length - 1].day <= singaporeDayKey(NOW)).toBe(true);
  });

  it("is deterministic for the same day", () => {
    expect(buildDemoAttendance(NOW, SYNCED_AT)).toEqual(rows);
  });

  it("returns each day at most once, in order, with positive durations", () => {
    const days = rows.map((row) => row.day);
    expect(new Set(days).size).toBe(days.length);
    expect([...days].sort()).toEqual(days);
    expect(rows.every((row) => row.seconds > 0)).toBe(true);
  });

  it("keeps plausible daily totals (under 12 hours, 5-minute granularity)", () => {
    expect(rows.every((row) => row.seconds <= 12 * 3600 && row.seconds % 300 === 0)).toBe(true);
  });

  it("is mostly weekday attendance", () => {
    const weekdayRows = rows.filter((row) => isSingaporeWeekdayKey(row.day)).length;
    expect(weekdayRows / rows.length).toBeGreaterThan(0.8);
  });

  it("marks only today as a live (provisional) row", () => {
    expect(rows.find((row) => row.day === "2026-10-14")!.source).toBe("locations_live");
    expect(rows.filter((row) => row.day !== "2026-10-14").every((row) => row.source === "locations")).toBe(true);
  });

  it("caps today as a partial day", () => {
    const today = rows.find((row) => row.day === "2026-10-14");
    expect(today).toBeDefined();
    expect(today!.seconds).toBeLessThanOrEqual(3.25 * 3600);
  });
});

describe("other fixtures", () => {
  it("builds a weekday goal that reconciles daily, weekly and monthly", () => {
    const goal = buildDemoGoal(NOW, "demo-user");
    expect(goal.daily_seconds * goal.days_per_week).toBe(goal.weekly_seconds);
    expect(goal.pace_mode).toBe("weekdays");
  });

  it("starts with a fresh successful sync and an older failed one", () => {
    const runs = buildDemoSyncRuns(NOW);
    const latest = runs[0];
    expect(latest.status).toBe("success");
    const ageMs = NOW.getTime() - new Date(latest.finished_at!).getTime();
    expect(ageMs).toBeLessThan(6 * 3600_000); // not stale
    expect(runs.some((run) => run.status === "failed")).toBe(true);
  });

  it("places deadlines relative to today", () => {
    const deadlines = buildDemoDeadlines(NOW, "demo-user");
    expect(deadlines.find((row) => row.is_completed)!.due_at < "2026-10-14").toBe(true);
    expect(deadlines.filter((row) => !row.is_completed).every((row) => row.due_at > "2026-10-14")).toBe(
      true
    );
  });
});
