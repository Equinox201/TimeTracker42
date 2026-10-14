import { describe, expect, it } from "vitest";

import { deadlineProgress, type DeadlineProgressInput } from "./deadlines";

const base: DeadlineProgressInput = {
  startOn: "2026-10-05",
  dueOn: "2026-10-23",
  targetHours: 40,
  todayKey: "2026-10-14",
  hoursByDay: {},
  weekdaysOnly: true
};

describe("deadlineProgress", () => {
  it("counts only attendance from the start date up to today", () => {
    const progress = deadlineProgress({
      ...base,
      hoursByDay: {
        "2026-10-02": 9, // before the deadline started
        "2026-10-06": 6,
        "2026-10-13": 4,
        "2026-10-20": 8 // in the future
      }
    });

    expect(progress.attendedHours).toBe(10);
    expect(progress.hoursLeft).toBe(30);
    expect(progress.status).toBe("open");
  });

  it("spreads the remaining hours over the remaining weekdays, counting today", () => {
    // Wed 14 -> Fri 23: 14,15,16,19,20,21,22,23 = 8 weekdays.
    const progress = deadlineProgress({ ...base, hoursByDay: { "2026-10-06": 8 } });

    expect(progress.daysLeft).toBe(8);
    expect(progress.hoursLeft).toBe(32);
    expect(progress.requiredPerDay).toBe(4);
  });

  it("uses calendar days when weekends count", () => {
    const progress = deadlineProgress({ ...base, weekdaysOnly: false, hoursByDay: { "2026-10-06": 8 } });

    expect(progress.daysLeft).toBe(10); // 14..23
    expect(progress.requiredPerDay).toBe(3.2);
  });

  it("does not depend on the calendar month (deadline due next month)", () => {
    const progress = deadlineProgress({
      ...base,
      startOn: "2026-10-20",
      dueOn: "2026-11-10",
      targetHours: 60,
      todayKey: "2026-10-30",
      hoursByDay: { "2026-10-21": 10, "2026-10-29": 5, "2026-10-15": 50 }
    });

    expect(progress.attendedHours).toBe(15);
    expect(progress.hoursLeft).toBe(45);
    expect(progress.status).toBe("open");
  });

  it("is achieved once the target is met, whatever the date", () => {
    const progress = deadlineProgress({ ...base, hoursByDay: { "2026-10-06": 45 } });

    expect(progress).toMatchObject({ status: "achieved", hoursLeft: 0, requiredPerDay: 0 });
  });

  it("is overdue after the due date with hours still missing", () => {
    const progress = deadlineProgress({
      ...base,
      todayKey: "2026-10-30",
      hoursByDay: { "2026-10-06": 10, "2026-10-26": 20 } // 26th is after the due date
    });

    expect(progress.status).toBe("overdue");
    expect(progress.attendedHours).toBe(10);
    expect(progress.hoursLeft).toBe(30);
    expect(progress.daysLeft).toBe(0);
  });

  it("treats the due day itself as still open", () => {
    const progress = deadlineProgress({ ...base, todayKey: "2026-10-23", hoursByDay: { "2026-10-06": 30 } });

    expect(progress.status).toBe("open");
    expect(progress.daysLeft).toBe(1);
    expect(progress.requiredPerDay).toBe(10);
  });
});
