import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDemoDeadline,
  deleteDemoDeadline,
  demoAttendanceRows,
  demoDeadlineRows,
  demoGoalRow,
  demoLatestSuccessfulSyncRun,
  demoLatestSyncRun,
  resetDemoStore,
  runDemoSync,
  setDemoGoal,
  updateDemoDeadline
} from "./demoStore";

const NOW = new Date("2026-10-14T06:00:00Z");

beforeEach(() => {
  resetDemoStore(NOW);
});

describe("goals", () => {
  it("updates goal fields and bumps updated_at", () => {
    const before = demoGoalRow();
    const after = setDemoGoal({ monthly_seconds: 80 * 3600 });
    expect(after.monthly_seconds).toBe(80 * 3600);
    expect(after.daily_seconds).toBe(before.daily_seconds);
    expect(demoGoalRow().monthly_seconds).toBe(80 * 3600);
  });
});

describe("deadlines", () => {
  it("creates, updates and deletes", () => {
    const created = createDemoDeadline({
      title: "Write README",
      due_at: "2026-10-30T00:00:00.000Z",
      target_seconds: 3600,
      notes: null
    });
    expect(demoDeadlineRows().some((row) => row.id === created.id)).toBe(true);

    const updated = updateDemoDeadline(created.id, { is_completed: true });
    expect(updated.is_completed).toBe(true);

    deleteDemoDeadline(created.id);
    expect(demoDeadlineRows().some((row) => row.id === created.id)).toBe(false);
  });

  it("returns deadlines ordered by due date and rejects unknown ids", () => {
    const dueDates = demoDeadlineRows().map((row) => row.due_at);
    expect([...dueDates].sort()).toEqual(dueDates);
    expect(() => updateDemoDeadline("missing", { title: "x" })).toThrow("Deadline not found.");
  });

  it("does not leak mutations through returned rows", () => {
    const [first] = demoDeadlineRows();
    first.title = "tampered";
    expect(demoDeadlineRows()[0].title).not.toBe("tampered");
  });
});

describe("attendance", () => {
  it("filters by inclusive day range", () => {
    const rows = demoAttendanceRows("2026-10-01", "2026-10-14");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.day >= "2026-10-01" && row.day <= "2026-10-14")).toBe(true);
  });
});

describe("runDemoSync", () => {
  it("adds a successful run and increases today's total", async () => {
    vi.useFakeTimers();
    const clock = () => NOW;
    const before = demoAttendanceRows("2026-10-14", "2026-10-14")[0]?.seconds ?? 0;

    const pending = runDemoSync(clock);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    vi.useRealTimers();

    expect(result.status).toBe("success");
    expect(demoLatestSyncRun()?.id).toBe(result.syncRunId);
    expect(demoLatestSuccessfulSyncRun()?.id).toBe(result.syncRunId);
    const after = demoAttendanceRows("2026-10-14", "2026-10-14")[0].seconds;
    expect(after).toBe(before + 30 * 60);
  });
});
