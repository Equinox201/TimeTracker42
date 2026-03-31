import { ReactNode } from "react";

type MetricTint = "magenta" | "mint" | "teal" | "neutral";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  tint?: MetricTint;
  trailing?: ReactNode;
};

const tintStyles: Record<MetricTint, string> = {
  magenta: "border-tt42-magenta/30 bg-tt42-magenta/10",
  mint: "border-tt42-mint/30 bg-tt42-mint/10",
  teal: "border-tt42-teal/30 bg-tt42-teal/10",
  neutral: "border-tt42-border bg-tt42-surface2"
};

export function MetricCard({ title, value, subtitle, tint = "neutral", trailing }: MetricCardProps) {
  return (
    <article className={`rounded-2xl border p-3 shadow-soft ${tintStyles[tint]}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-tt42-muted">{title}</p>
      <p className="mt-2 text-xl font-semibold leading-none text-tt42-text">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-tt42-muted">{subtitle ?? ""}</p>
        {trailing}
      </div>
    </article>
  );
}
