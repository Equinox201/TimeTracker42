import { shortDateTime } from "../../lib/formatters";

type StaleDataBannerProps = {
  isStale: boolean;
  staleAgeHours: number | null;
  lastSyncedAt: string | null;
};

function staleMessage(isStale: boolean, staleAgeHours: number | null): string {
  if (isStale) {
    const age = staleAgeHours ?? 0;
    return `Data may be stale. Last successful sync ~${age.toFixed(1)}h ago.`;
  }
  return "Data is fresh.";
}

export function StaleDataBanner({ isStale, staleAgeHours, lastSyncedAt }: StaleDataBannerProps) {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-2 text-sm",
        isStale
          ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
          : "border-tt42-mint/30 bg-tt42-mint/10 text-tt42-text"
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{staleMessage(isStale, staleAgeHours)}</p>
        <p className="text-[11px] text-tt42-muted">Last sync: {shortDateTime(lastSyncedAt)}</p>
      </div>
    </div>
  );
}
