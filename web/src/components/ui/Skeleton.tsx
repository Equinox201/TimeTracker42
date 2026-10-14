export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-tt42-surface2 ${className}`.trim()} />;
}
