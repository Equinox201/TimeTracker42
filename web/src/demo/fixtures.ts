import {
  addSingaporeDaysKey,
  addSingaporeMonthsKey,
  isSingaporeWeekdayKey,
  singaporeDayKey,
  singaporeMonthKey
} from "../lib/singaporeDate";

// Synthetic data for demo mode. Everything is derived from "now", so the demo always shows a
// current month; day values come from a hash of the date, so a given day is stable between loads.

export type DemoAttendanceRow = {
  day: string;
  seconds: number;
  source: string;
  synced_at: string;
};

export type DemoGoalRow = {
  user_id: string;
  daily_seconds: number;
  weekly_seconds: number;
  monthly_seconds: number;
  pace_mode: "calendar_days" | "weekdays";
  days_per_week: number;
  updated_at: string;
};

export type DemoSyncRunRow = {
  id: string;
  status: "success" | "failed" | "running";
  started_at: string;
  finished_at: string | null;
};

export type DemoDeadlineRow = {
  id: string;
  user_id: string;
  title: string;
  due_at: string;
  target_seconds: number | null;
  notes: string | null;
  is_completed: boolean;
};

const HISTORY_MONTHS = 6;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// FNV-1a: tiny, deterministic, good enough to spread day keys over [0, 1).
function unitHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function secondsFromHours(hours: number): number {
  // Round to 5 minutes so values look like real campus sessions.
  return Math.round(hours * 12) * 300;
}

export function demoHistoryStartKey(now: Date): string {
  const currentMonth = singaporeMonthKey(now);
  return `${addSingaporeMonthsKey(currentMonth, -(HISTORY_MONTHS - 1))}-01`;
}

export function buildDemoAttendance(now: Date, syncedAt: string): DemoAttendanceRow[] {
  const todayKey = singaporeDayKey(now);
  const rows: DemoAttendanceRow[] = [];

  for (let day = demoHistoryStartKey(now); day <= todayKey; day = addSingaporeDaysKey(day, 1)) {
    const presence = unitHash(`${day}:presence`);
    const length = unitHash(`${day}:length`);
    let seconds = 0;

    if (isSingaporeWeekdayKey(day)) {
      // Roughly one weekday in twelve is a day off.
      if (presence >= 0.08) {
        seconds = secondsFromHours(3.5 + length * 3.5);
      }
    } else if (presence < 0.18) {
      // Occasional weekend session.
      seconds = secondsFromHours(2 + length * 3);
    }

    if (day === todayKey && seconds > 0) {
      seconds = Math.min(seconds, secondsFromHours(3.25));
    }

    if (seconds > 0) {
      rows.push({ day, seconds, source: "demo", synced_at: syncedAt });
    }
  }

  return rows;
}

export function buildDemoGoal(now: Date, userId: string): DemoGoalRow {
  return {
    user_id: userId,
    daily_seconds: 5 * 3600,
    weekly_seconds: 25 * 3600,
    monthly_seconds: 110 * 3600,
    pace_mode: "weekdays",
    days_per_week: 5,
    updated_at: new Date(`${singaporeMonthKey(now)}-01T00:00:00.000Z`).toISOString()
  };
}

export function buildDemoSyncRuns(now: Date): DemoSyncRunRow[] {
  const at = (offsetMs: number) => new Date(now.getTime() - offsetMs).toISOString();

  return [
    {
      id: "demo-run-3",
      status: "success",
      started_at: at(26 * MINUTE_MS),
      finished_at: at(25 * MINUTE_MS)
    },
    {
      id: "demo-run-2",
      status: "failed",
      started_at: at(2 * DAY_MS),
      finished_at: at(2 * DAY_MS - 4_000)
    },
    {
      id: "demo-run-1",
      status: "success",
      started_at: at(3 * DAY_MS),
      finished_at: at(3 * DAY_MS - 6_000)
    }
  ];
}

export function buildDemoDeadlines(now: Date, userId: string): DemoDeadlineRow[] {
  const todayKey = singaporeDayKey(now);
  const due = (days: number) => `${addSingaporeDaysKey(todayKey, days)}T00:00:00.000Z`;

  return [
    {
      id: "demo-deadline-1",
      user_id: userId,
      title: "Core project submission",
      due_at: due(9),
      target_seconds: 90 * 3600,
      notes: "Peer evaluations must be booked two days before.",
      is_completed: false
    },
    {
      id: "demo-deadline-2",
      user_id: userId,
      title: "Exam preparation",
      due_at: due(21),
      target_seconds: 130 * 3600,
      notes: null,
      is_completed: false
    },
    {
      id: "demo-deadline-3",
      user_id: userId,
      title: "Evaluation backlog",
      due_at: due(-4),
      target_seconds: 30 * 3600,
      notes: "Finished early.",
      is_completed: true
    }
  ];
}
