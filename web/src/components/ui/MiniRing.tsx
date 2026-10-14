type MiniRingProps = {
  ratio: number; // 1 = goal reached; values above 1 are capped visually
  size?: number;
  label: string;
};

// A small progress ring for stat tiles. Percent is in the accessible name, not drawn.
export function MiniRing({ ratio, size = 40, label }: MiniRingProps) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0, 0), 1);

  return (
    <svg
      role="img"
      aria-label={`${label}: ${Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)}% of goal`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--tt42-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--tt42-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * clamped} ${circumference}`}
        style={{ transition: "stroke-dasharray 400ms ease" }}
      />
    </svg>
  );
}
