import type { ReactNode } from "react";

import { Stat } from "../ui/Stat";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  trailing?: ReactNode;
};

// Thin wrapper kept so pages read the same; the look lives in ui/Stat.
export function MetricCard({ title, value, subtitle, trailing }: MetricCardProps) {
  return <Stat label={title} value={value} hint={subtitle} trailing={trailing} />;
}
