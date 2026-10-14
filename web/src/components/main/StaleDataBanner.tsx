import { shortDateTime } from "../../lib/formatters";
import { Banner } from "../ui/Banner";

type StaleDataBannerProps = {
  isStale: boolean;
  staleAgeHours: number | null;
  lastSyncedAt: string | null;
  syncStatus?: "success" | "failed" | "running" | null;
  syncStartedAt?: string | null;
  syncFinishedAt?: string | null;
  // Extra context lines (live session note, last manual sync result) shown inside the same block.
  notes?: string[];
};

function staleMessage(isStale: boolean, staleAgeHours: number | null, lastSyncedAt: string | null): string {
  if (!lastSyncedAt) {
    return "Never synced. Run Sync Now to pull your 42 attendance.";
  }
  if (isStale) {
    const age = staleAgeHours ?? 0;
    return `Data may be stale. Last successful sync ~${age.toFixed(1)}h ago.`;
  }
  return "Data is fresh.";
}

function statusMessage(
  syncStatus: StaleDataBannerProps["syncStatus"],
  syncStartedAt: string | null | undefined,
  syncFinishedAt: string | null | undefined
): string | null {
  if (syncStatus === "failed") {
    return `Last sync failed${syncFinishedAt ? ` at ${shortDateTime(syncFinishedAt)}` : ""}.`;
  }
  if (syncStatus === "running") {
    return `Sync started ${shortDateTime(syncStartedAt ?? null)}.`;
  }
  return null;
}

export function StaleDataBanner({
  isStale,
  staleAgeHours,
  lastSyncedAt,
  syncStatus = null,
  syncStartedAt = null,
  syncFinishedAt = null,
  notes = []
}: StaleDataBannerProps) {
  const latestStatus = statusMessage(syncStatus, syncStartedAt, syncFinishedAt);
  const hasFailure = syncStatus === "failed";

  const tone = hasFailure ? "danger" : isStale ? "warn" : "success";

  return (
    <Banner tone={tone}>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="font-medium">{staleMessage(isStale, staleAgeHours, lastSyncedAt)}</p>
          {latestStatus ? <p className="text-xs text-tt42-muted">{latestStatus}</p> : null}
          {notes.map((note) => (
            <p key={note} className="text-xs text-tt42-muted">
              {note}
            </p>
          ))}
        </div>
        <p className="text-xs text-tt42-muted tabular-nums">
          Last synced: {lastSyncedAt ? shortDateTime(lastSyncedAt) : "Never synced"}
        </p>
      </div>
    </Banner>
  );
}
