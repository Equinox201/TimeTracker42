import { countRemainingSingaporeDays } from "./singaporeDate";

// Deadline progress. A deadline's target is the attendance wanted between its own start date
// and its due date, so it does not depend on which calendar month it is viewed in.

export type DeadlineProgressInput = {
  startOn: string; // day key
  dueOn: string; // day key
  targetHours: number;
  todayKey: string;
  hoursByDay: Record<string, number>;
  weekdaysOnly: boolean;
};

export type DeadlineStatus = "achieved" | "open" | "overdue";

export type DeadlineProgress = {
  attendedHours: number;
  hoursLeft: number;
  daysLeft: number;
  requiredPerDay: number;
  status: DeadlineStatus;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function deadlineProgress(input: DeadlineProgressInput): DeadlineProgress {
  const countUntil = input.todayKey < input.dueOn ? input.todayKey : input.dueOn;

  const attendedHours = Object.entries(input.hoursByDay)
    .filter(([day]) => day >= input.startOn && day <= countUntil)
    .reduce((sum, [, hours]) => sum + Math.max(hours, 0), 0);

  const hoursLeft = Math.max(input.targetHours - attendedHours, 0);
  const isPast = input.dueOn < input.todayKey;

  if (hoursLeft === 0) {
    return { attendedHours: round2(attendedHours), hoursLeft: 0, daysLeft: 0, requiredPerDay: 0, status: "achieved" };
  }

  if (isPast) {
    return {
      attendedHours: round2(attendedHours),
      hoursLeft: round2(hoursLeft),
      daysLeft: 0,
      requiredPerDay: 0,
      status: "overdue"
    };
  }

  // Today counts as a day left, in the same pace mode (weekdays or calendar days) as the goals.
  const daysLeft = countRemainingSingaporeDays(input.todayKey, input.dueOn, input.weekdaysOnly);

  return {
    attendedHours: round2(attendedHours),
    hoursLeft: round2(hoursLeft),
    daysLeft,
    requiredPerDay: round2(hoursLeft / daysLeft),
    status: "open"
  };
}
