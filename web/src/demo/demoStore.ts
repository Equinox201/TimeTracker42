import { singaporeDayKey } from "../lib/singaporeDate";
import { DEMO_USER } from "./demoMode";
import {
  buildDemoAttendance,
  buildDemoDeadlines,
  buildDemoGoal,
  buildDemoSyncRuns,
  type DemoAttendanceRow,
  type DemoDeadlineRow,
  type DemoGoalRow,
  type DemoSyncRunRow
} from "./fixtures";

// In-memory stand-in for the Postgres tables. State is created lazily on first read and is
// intentionally never persisted: a reload resets the demo to its initial data.

type DemoState = {
  goal: DemoGoalRow;
  attendance: DemoAttendanceRow[];
  syncRuns: DemoSyncRunRow[];
  deadlines: DemoDeadlineRow[];
  sequence: number;
};

export type DemoSyncResult = {
  syncRunId: string;
  status: string;
  insertedDays: number;
  updatedDays: number;
  unchangedDays: number;
  startedAt: string;
  finishedAt: string;
};

const SYNC_DELAY_MS = 900;
const SYNC_BUMP_SECONDS = 30 * 60;

let state: DemoState | null = null;

function createState(now: Date): DemoState {
  const syncRuns = buildDemoSyncRuns(now);
  const lastSuccess = syncRuns.find((run) => run.status === "success");
  return {
    goal: buildDemoGoal(now, DEMO_USER.id),
    attendance: buildDemoAttendance(now, lastSuccess?.finished_at ?? now.toISOString()),
    syncRuns,
    deadlines: buildDemoDeadlines(now, DEMO_USER.id),
    sequence: 0
  };
}

function current(): DemoState {
  if (!state) {
    state = createState(new Date());
  }
  return state;
}

// Test hook, and what a future "reset demo" action would call.
export function resetDemoStore(now: Date = new Date()): void {
  state = createState(now);
}

export function demoGoalRow(): DemoGoalRow {
  return { ...current().goal };
}

export function setDemoGoal(
  patch: Partial<Omit<DemoGoalRow, "user_id" | "updated_at">>
): DemoGoalRow {
  const next = current();
  next.goal = { ...next.goal, ...patch, updated_at: new Date().toISOString() };
  return { ...next.goal };
}

export function demoAttendanceRows(from: string, to: string): DemoAttendanceRow[] {
  return current()
    .attendance.filter((row) => row.day >= from && row.day <= to)
    .map((row) => ({ ...row }));
}

export function demoLatestSyncRun(): DemoSyncRunRow | null {
  const runs = [...current().syncRuns].sort((a, b) => b.started_at.localeCompare(a.started_at));
  return runs[0] ? { ...runs[0] } : null;
}

export function demoLatestSuccessfulSyncRun(): DemoSyncRunRow | null {
  const runs = current()
    .syncRuns.filter((run) => run.status === "success")
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""));
  return runs[0] ? { ...runs[0] } : null;
}

export function demoDeadlineRows(): DemoDeadlineRow[] {
  return [...current().deadlines]
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .map((row) => ({ ...row }));
}

export function createDemoDeadline(
  input: Pick<DemoDeadlineRow, "title" | "due_at" | "target_seconds" | "notes">
): DemoDeadlineRow {
  const next = current();
  next.sequence += 1;
  const row: DemoDeadlineRow = {
    id: `demo-deadline-new-${next.sequence}`,
    user_id: DEMO_USER.id,
    is_completed: false,
    ...input
  };
  next.deadlines.push(row);
  return { ...row };
}

export function updateDemoDeadline(
  id: string,
  patch: Partial<Omit<DemoDeadlineRow, "id" | "user_id">>
): DemoDeadlineRow {
  const next = current();
  const index = next.deadlines.findIndex((row) => row.id === id);
  if (index === -1) {
    throw new Error("Deadline not found.");
  }
  next.deadlines[index] = { ...next.deadlines[index], ...patch };
  return { ...next.deadlines[index] };
}

export function deleteDemoDeadline(id: string): void {
  const next = current();
  next.deadlines = next.deadlines.filter((row) => row.id !== id);
}

// Simulates the manual 42 sync: short delay, a new successful run, and half an hour more
// on today's total so the dashboard visibly changes.
export async function runDemoSync(now: () => Date = () => new Date()): Promise<DemoSyncResult> {
  const next = current();
  const startedAt = now();
  await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));
  const finishedAt = now();

  const today = singaporeDayKey(finishedAt);
  const finishedIso = finishedAt.toISOString();
  const existing = next.attendance.find((row) => row.day === today);
  if (existing) {
    existing.seconds += SYNC_BUMP_SECONDS;
    existing.synced_at = finishedIso;
  } else {
    next.attendance.push({
      day: today,
      seconds: SYNC_BUMP_SECONDS,
      source: "demo",
      synced_at: finishedIso
    });
    next.attendance.sort((a, b) => a.day.localeCompare(b.day));
  }

  next.sequence += 1;
  const run: DemoSyncRunRow = {
    id: `demo-run-live-${next.sequence}`,
    status: "success",
    started_at: startedAt.toISOString(),
    finished_at: finishedIso
  };
  next.syncRuns.push(run);

  return {
    syncRunId: run.id,
    status: "success",
    insertedDays: existing ? 0 : 1,
    updatedDays: existing ? 1 : 0,
    unchangedDays: Math.max(next.attendance.length - 1, 0),
    startedAt: run.started_at,
    finishedAt: finishedIso
  };
}
