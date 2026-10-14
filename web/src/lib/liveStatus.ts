// Whether today's total still includes an open campus session.
//
// The sync function stores today's row with source "locations_live" when a session was
// still open at sync time. The total is therefore provisional, and it is only as fresh as
// that sync (`synced_at`), which is what the UI shows.

export type AttendanceSourceRow = {
  day: string;
  source: string;
  synced_at: string;
};

export function todayLiveStatus(
  rows: AttendanceSourceRow[],
  todayKey: string
): { todayIsLive: boolean; liveCheckedAt: string | null } {
  const today = rows.find((row) => row.day === todayKey);
  if (!today || today.source !== "locations_live") {
    return { todayIsLive: false, liveCheckedAt: null };
  }

  return { todayIsLive: true, liveCheckedAt: today.synced_at };
}
