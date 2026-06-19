import { shortDateTime } from "../../lib/formatters";

type StaleDataBannerProps = {
  isStale: boolean;
  staleAgeHours: number | null;
  lastSyncedAt: string | null;
  syncStatus?: "success" | "failed" | "running" | null;
  syncStartedAt?: string | null;
  syncFinishedAt?: string | null;
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
  syncFinishedAt = null
}: StaleDataBannerProps) {
  const latestStatus = statusMessage(syncStatus, syncStartedAt, syncFinishedAt);
  const hasFailure = syncStatus === "failed";

  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-sm",
        hasFailure
          ? "border-tt42-danger/40 bg-tt42-danger/10 text-tt42-text"
          : isStale
          ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
          : "border-tt42-mint/30 bg-tt42-mint/10 text-tt42-text"
      ].join(" ")}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <p className="font-medium">{staleMessage(isStale, staleAgeHours, lastSyncedAt)}</p>
          {latestStatus ? <p className="text-xs text-tt42-muted">{latestStatus}</p> : null}
        </div>
        <p className="text-[11px] text-tt42-muted">
          Last synced: {lastSyncedAt ? shortDateTime(lastSyncedAt) : "Never synced"}
        </p>
      </div>
    </div>
  );
}
