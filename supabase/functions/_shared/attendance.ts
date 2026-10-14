// Attendance calculation for the manual 42 sync, kept free of I/O so it can be tested.
//
// 42 returns "locations": sessions at a campus host. Daily attendance is the time the
// student was present, bucketed by Asia/Singapore day (the same rule the web app uses).

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export type FortyTwoLocation = {
  id?: number;
  begin_at?: string | null;
  end_at?: string | null;
  host?: string | null;
  campus_id?: number | null;
  primary?: boolean | null;
};

export type NormalizedLocationSession = {
  id: number;
  user_id: string;
  begin_at: string;
  end_at: string | null;
  host: string | null;
  campus_id: number | null;
  primary_location: boolean | null;
  synced_at: string;
};

export type DailyTotal = {
  seconds: number;
  hasLive: boolean;
};

export function dateKeyInSingapore(value: Date): string {
  return new Date(value.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

export function singaporeDayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00+08:00`);
}

export function nextSingaporeDayStartMs(day: string): number {
  return singaporeDayStartMs(day) + DAY_MS;
}

// First instant of the Singapore month five months before the current one, so the
// six-month History view is fully populated.
export function singaporeHistoricalWindowStart(value: Date): Date {
  const local = new Date(value.getTime() + SINGAPORE_OFFSET_MS);
  const windowStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 5, 1));
  const month = String(windowStart.getUTCMonth() + 1).padStart(2, "0");
  return new Date(`${windowStart.getUTCFullYear()}-${month}-01T00:00:00+08:00`);
}

export function normalizeLocation(
  location: FortyTwoLocation,
  userId: string,
  syncedAt: string
): NormalizedLocationSession | null {
  if (typeof location.id !== "number" || !Number.isSafeInteger(location.id)) {
    return null;
  }

  if (!location.begin_at || !Number.isFinite(new Date(location.begin_at).getTime())) {
    return null;
  }

  if (location.end_at && !Number.isFinite(new Date(location.end_at).getTime())) {
    return null;
  }

  return {
    id: location.id,
    user_id: userId,
    begin_at: location.begin_at,
    end_at: location.end_at ?? null,
    host: location.host ?? null,
    campus_id: typeof location.campus_id === "number" ? location.campus_id : null,
    primary_location: typeof location.primary === "boolean" ? location.primary : null,
    synced_at: syncedAt
  };
}

export function uniqueLocations(locations: FortyTwoLocation[]): FortyTwoLocation[] {
  const byId = new Map<number, FortyTwoLocation>();

  for (const location of locations) {
    if (typeof location.id === "number") {
      byId.set(location.id, location);
    }
  }

  return Array.from(byId.values());
}

type Interval = { startMs: number; endMs: number };

// Calls `visit` once per Singapore day the interval touches, with whole seconds in that day.
function forEachDaySegment(
  interval: Interval,
  visit: (day: string, seconds: number) => void
): void {
  let cursorMs = interval.startMs;
  while (cursorMs < interval.endMs) {
    const day = dateKeyInSingapore(new Date(cursorMs));
    const segmentEndMs = Math.min(interval.endMs, nextSingaporeDayStartMs(day));
    const seconds = Math.max(0, Math.floor((segmentEndMs - cursorMs) / 1000));
    if (seconds > 0) {
      visit(day, seconds);
    }
    cursorMs = segmentEndMs;
  }
}

// Daily presence in seconds. Sessions are clipped to [windowStart, now], overlapping or
// touching sessions are merged first (presence is elapsed time, not the sum of sessions),
// and the result is split at Singapore midnight.
export function computeDailyTotals(
  sessions: NormalizedLocationSession[],
  windowStart: Date,
  now: Date
): Map<string, DailyTotal> {
  const windowStartMs = windowStart.getTime();
  const nowMs = now.getTime();

  const clipped: Array<Interval & { live: boolean }> = [];
  for (const session of sessions) {
    const beginMs = new Date(session.begin_at).getTime();
    const rawEndMs = session.end_at ? new Date(session.end_at).getTime() : nowMs;
    const startMs = Math.max(beginMs, windowStartMs);
    const endMs = Math.min(rawEndMs, nowMs);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      continue;
    }

    clipped.push({ startMs, endMs, live: session.end_at === null });
  }

  clipped.sort((a, b) => a.startMs - b.startMs);

  const merged: Interval[] = [];
  for (const interval of clipped) {
    const last = merged[merged.length - 1];
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
    } else {
      merged.push({ startMs: interval.startMs, endMs: interval.endMs });
    }
  }

  const totals = new Map<string, DailyTotal>();
  for (const interval of merged) {
    forEachDaySegment(interval, (day, seconds) => {
      const total = totals.get(day) ?? { seconds: 0, hasLive: false };
      total.seconds += seconds;
      totals.set(day, total);
    });
  }

  // A day is "live" when a still-open session contributes to it.
  for (const interval of clipped) {
    if (!interval.live) {
      continue;
    }
    forEachDaySegment(interval, (day) => {
      const total = totals.get(day);
      if (total) {
        total.hasLive = true;
      }
    });
  }

  return totals;
}

// Days in [fromDay, toDay] that still hold time locally but have no sessions in a complete
// fetch: the source no longer reports them, so they must be zeroed.
export function daysToZero(
  existing: Array<{ day: string; seconds: number }>,
  totals: Map<string, DailyTotal>,
  fromDay: string,
  toDay: string
): string[] {
  return existing
    .filter((row) => row.day >= fromDay && row.day <= toDay && row.seconds > 0 && !totals.has(row.day))
    .map((row) => row.day)
    .sort();
}
