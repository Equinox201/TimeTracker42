export function hoursToReadable(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(hours, 0) : 0;
  const totalMinutes = Math.round(safe * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

export function hoursToCompact(hours: number): string {
  const safe = Number.isFinite(hours) ? Math.max(hours, 0) : 0;
  return `${safe.toFixed(1)}h`;
}

export function deltaHoursReadable(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";
  return `${sign}${hoursToReadable(Math.abs(safe))}`;
}

export function progressPercent(valueHours: number, goalHours: number): string {
  const safeValue = Number.isFinite(valueHours) ? Math.max(valueHours, 0) : 0;
  const safeGoal = Number.isFinite(goalHours) ? goalHours : 0;

  if (safeGoal <= 0) {
    return "0%";
  }

  return `${Math.round((safeValue / safeGoal) * 100)}%`;
}

export function monthYearLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function shortDateTime(isoValue: string | null): string {
  if (!isoValue) {
    return "Unknown";
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
