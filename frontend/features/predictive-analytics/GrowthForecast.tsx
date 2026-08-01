"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LineChart } from "@/components/dashboard/LineChart";
import type { TwinResponse } from "@/types/analytics";
import {
  averageCurrentReadiness,
  averageProjectedReadiness,
} from "./use-predictive-data";
import {
  TIMELINE_LABELS,
  type TimelineFilter,
} from "./use-predictive-filters";

interface GrowthForecastProps {
  twin: TwinResponse;
  timeline: TimelineFilter;
}

/**
 * Growth Forecast — multi-series line chart over the four
 * deterministic timeline points the engine already produced:
 *
 *   - Business Score Trend = twin.timeline.*.projected_overall_score
 *   - Readiness Trend      = avg of the 4 projected pillar
 *                            scores (digital, compliance,
 *                            export, growth) at each timeline
 *                            point. "Current" point uses the
 *                            4 actual maturity fields from
 *                            twin.health_summary.
 *   - DNA Trend            = twin.current_health.business_dna_match
 *                            at all 4 points (the engine does
 *                            not project DNA; this is a flat
 *                            reference line labelled "current
 *                            only").
 *
 * When the user narrows the timeline filter (3m / 6m / 12m)
 * the chart shows the same series but restricted to the
 * chosen future point plus the current baseline, so the
 * curve still has a "from" anchor to compare against.
 */
export function GrowthForecast({ twin, timeline }: GrowthForecastProps) {
  const labels = useMemo(() => {
    if (timeline === "all") return [...TIMELINE_LABELS];
    const idx = TIMELINE_LABELS.findIndex((l) =>
      timeline === "3m"
        ? l === "3 Months"
        : timeline === "6m"
          ? l === "6 Months"
          : l === "12 Months",
    );
    if (idx <= 0) return [...TIMELINE_LABELS];
    return [TIMELINE_LABELS[0], TIMELINE_LABELS[idx]];
  }, [timeline]);

  const series = useMemo(() => {
    const tl = twin.timeline;
    const businessScoreAll = [
      tl.current.projected_overall_score,
      tl.three_month.projected_overall_score,
      tl.six_month.projected_overall_score,
      tl.twelve_month.projected_overall_score,
    ];
    const readinessAll = [
      averageCurrentReadiness(twin),
      averageProjectedReadiness(tl.three_month),
      averageProjectedReadiness(tl.six_month),
      averageProjectedReadiness(tl.twelve_month),
    ];
    const dna = twin.current_health.business_dna_match;
    const dnaAll = [dna, dna, dna, dna];

    if (timeline === "all") {
      return [businessScoreAll, readinessAll, dnaAll];
    }
    const idx = TIMELINE_LABELS.findIndex((l) =>
      timeline === "3m"
        ? l === "3 Months"
        : timeline === "6m"
          ? l === "6 Months"
          : l === "12 Months",
    );
    if (idx <= 0) return [businessScoreAll, readinessAll, dnaAll];
    return [
      [businessScoreAll[0], businessScoreAll[idx]],
      [readinessAll[0], readinessAll[idx]],
      [dnaAll[0], dnaAll[idx]],
    ];
  }, [twin, timeline]);

  return (
    <DashboardCard
      badge="Forecast"
      title="Growth Forecast"
      caption="Deterministic projection series from the Digital Twin timeline."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <LineChart
          labels={labels}
          series={[
            {
              label: "Business Score Trend",
              values: series[0],
              color: "hsl(var(--primary))",
            },
            {
              label: "Readiness Trend",
              values: series[1],
              color: "hsl(var(--muted-foreground))",
              dashed: false,
            },
            {
              label: "DNA Trend (current only)",
              values: series[2],
              color: "hsl(var(--accent-foreground, 0 0% 45%))",
              dashed: true,
            },
          ]}
          ariaLabel="Growth forecast over the selected timeline"
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            Series
          </p>
          <SeriesRow
            color="hsl(var(--primary))"
            label="Business Score Trend"
            value={`${series[0][0]} → ${series[0][series[0].length - 1]}`}
          />
          <SeriesRow
            color="hsl(var(--muted-foreground))"
            label="Readiness Trend"
            value={`${series[1][0]} → ${series[1][series[1].length - 1]}`}
          />
          <SeriesRow
            color="hsl(var(--muted-foreground))"
            label="DNA Trend"
            value={`${series[2][0]} (no projection)`}
            dashed
          />
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            DNA Trend is a flat line because the engine does
            not project DNA; the value reflects
            <span className="font-mono"> current_health.business_dna_match</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-primary"
            aria-hidden="true"
          />
          Business Score Trend
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-muted-foreground"
            aria-hidden="true"
          />
          Readiness Trend
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full border border-muted-foreground bg-transparent"
            aria-hidden="true"
          />
          DNA Trend (dashed)
        </span>
      </div>
    </DashboardCard>
  );
}

interface SeriesRowProps {
  color: string;
  label: string;
  value: string;
  dashed?: boolean;
}

function SeriesRow({ color, label, value, dashed }: SeriesRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-foreground">
        <span
          className="size-2 rounded-full"
          style={{
            background: dashed ? "transparent" : color,
            borderColor: dashed ? color : "transparent",
            borderWidth: dashed ? 1 : 0,
          }}
          aria-hidden="true"
        />
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
