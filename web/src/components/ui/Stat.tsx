import type { ReactNode } from "react";

type StatProps = {
  label: string;
  value: string;
  hint?: string;
  trailing?: ReactNode;
};

// Label, one number, one line of context. Numbers are tabular so columns of hours line up.
export function Stat({ label, value, hint, trailing }: StatProps) {
  return (
    <div className="rounded-2xl bg-tt42-surface2 p-4">
      <p className="text-xs font-medium text-tt42-muted">{label}</p>
      <p className="mt-1.5 text-xl font-semibold leading-none tracking-tight tabular-nums text-tt42-text">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-tt42-muted">{hint ?? ""}</p>
        {trailing}
      </div>
    </div>
  );
}
