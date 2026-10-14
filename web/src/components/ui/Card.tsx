import type { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  as?: "article" | "section" | "div";
  padding?: "none" | "sm" | "md";
  className?: string;
}>;

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5"
} as const;

// A surface, not an outlined box: tone step plus a hairline that is only there to keep
// the light theme from looking washed out.
export function Card({ as: Tag = "article", padding = "md", className = "", children }: CardProps) {
  return (
    <Tag
      className={`rounded-card bg-tt42-surface ring-1 ring-inset ring-tt42-border/60 ${paddingClass[padding]} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
