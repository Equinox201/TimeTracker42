import { useMemo } from "react";

import { buildDemoAttendance } from "../../demo/fixtures";
import { buildCumulativeSeries } from "../../lib/cumulative";
import { computePace } from "../../lib/pace";
import { singaporeDayKey, singaporeMonthKey } from "../../lib/singaporeDate";
import { PaceHero } from "../main/PaceHero";
import { Card } from "../ui/Card";

const SAMPLE_GOAL_HOURS = 110;

// A non-interactive look at the real dashboard hero, built from the same synthetic data as
// demo mode. Nothing here touches the network.
export function DashboardPreview() {
  const preview = useMemo(() => {
    const now = new Date();
    const todayKey = singaporeDayKey(now);
    const monthKey = singaporeMonthKey(now);

    const hoursByDay: Record<string, number> = {};
    let hoursMonth = 0;
    for (const row of buildDemoAttendance(now, now.toISOString())) {
      if (row.day.startsWith(monthKey)) {
        const hours = row.seconds / 3600;
        hoursByDay[row.day] = hours;
        hoursMonth += hours;
      }
    }

    return {
      hoursMonth,
      pace: computePace({ todayKey, monthlyGoalHours: SAMPLE_GOAL_HOURS, hoursMonth, weekdaysOnly: true }),
      series: buildCumulativeSeries({
        monthKey,
        todayKey,
        monthlyGoalHours: SAMPLE_GOAL_HOURS,
        weekdaysOnly: true,
        hoursByDay
      })
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none select-none">
      <Card padding="md" className="shadow-float">
        <PaceHero
          hoursMonth={preview.hoursMonth}
          goalHours={SAMPLE_GOAL_HOURS}
          pace={preview.pace}
          series={preview.series}
          weekDeltaHours={0}
          monthDeltaHours={0}
          showComparison={false}
        />
      </Card>
      <p className="mt-3 text-center text-xs text-tt42-muted">Sample data for a fictional student</p>
    </div>
  );
}
