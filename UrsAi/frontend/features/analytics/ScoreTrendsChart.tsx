"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LineChart } from "@/components/dashboard/LineChart";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import type { AnalyticsData } from "./use-analytics-data";

interface ScoreTrendsChartProps {
  data: AnalyticsData;
}

/**
 * Business score trends — line chart from the Digital Twin
 * timeline with current vs projected values from the Roadmap.
 */
export function ScoreTrendsChart({ data }: ScoreTrendsChartProps) {
  const { twin, roadmap } = data;
  const timeline = twin.timeline;
  const projections = roadmap.summary.projections;

  const labels = ["Now", "3 mo", "6 mo", "12 mo"];
  const currentSeries = [
    timeline.current.projected_overall_score,
    timeline.three_month.projected_overall_score,
    timeline.six_month.projected_overall_score,
    timeline.twelve_month.projected_overall_score,
  ];

  const projectedTarget = projections.projected_business_score;
  const projectedSeries = [
    twin.scores.overall_score,
    Math.round(
      twin.scores.overall_score +
        (projectedTarget - twin.scores.overall_score) * 0.25,
    ),
    Math.round(
      twin.scores.overall_score +
        (projectedTarget - twin.scores.overall_score) * 0.55,
    ),
    projectedTarget,
  ];

  return (
    <DashboardCard
      badge="Trends"
      title="Business Score Trends"
      caption="Timeline projections from the Digital Twin; dashed line shows roadmap target."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <LineChart
          labels={labels}
          series={[
            {
              label: "Timeline projection",
              values: currentSeries,
              color: "hsl(var(--primary))",
            },
            {
              label: "Roadmap target",
              values: projectedSeries,
              color: "hsl(var(--muted-foreground))",
              dashed: true,
            },
          ]}
          ariaLabel="Business score trends over 12 months"
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Current score</span>
            <AnimatedCounter
              value={twin.scores.overall_score}
              className="font-semibold text-foreground"
            />
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Projected (roadmap)</span>
            <AnimatedCounter
              value={projectedTarget}
              className="font-semibold text-primary"
            />
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">12-month timeline</span>
            <AnimatedCounter
              value={timeline.twelve_month.projected_overall_score}
              className="font-semibold text-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {timeline.twelve_month.notes}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          Timeline projection
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full border border-muted-foreground bg-transparent"
            aria-hidden="true"
          />
          Roadmap target (dashed)
        </span>
      </div>
    </DashboardCard>
  );
}
