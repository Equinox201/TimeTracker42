import type { PropsWithChildren } from "react";

export type BannerTone = "info" | "success" | "warn" | "danger";

const toneClass: Record<BannerTone, string> = {
  info: "bg-tt42-surface2 text-tt42-text",
  success: "bg-tt42-accent/10 text-tt42-text",
  warn: "bg-tt42-warn/10 text-tt42-text",
  danger: "bg-tt42-danger/10 text-tt42-text"
};

const dotClass: Record<BannerTone, string> = {
  info: "bg-tt42-muted",
  success: "bg-tt42-accent",
  warn: "bg-tt42-warn",
  danger: "bg-tt42-danger"
};

// A quiet status line: tone is a small dot, not a coloured box with an outline.
export function Banner({
  tone = "info",
  className = "",
  children
}: PropsWithChildren<{ tone?: BannerTone; className?: string }>) {
  return (
    <div
      role={tone === "danger" || tone === "warn" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm ${toneClass[tone]} ${className}`.trim()}
    >
      <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dotClass[tone]}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
