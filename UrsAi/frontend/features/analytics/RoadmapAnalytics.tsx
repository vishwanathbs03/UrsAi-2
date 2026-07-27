"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import type { RoadmapItem, RecommendationPhase } from "@/types/analytics";
import type { AnalyticsData } from "./use-analytics-data";

const PHASES: RecommendationPhase[] = [
  "Immediate",
  "Short-Term",
  "Medium-Term",
  "Long-Term",
];

interface RoadmapAnalyticsProps {
  data: AnalyticsData;
}

/**
 * Roadmap analytics — items grouped by phase plus
 * overall completion progress.
 */
export function RoadmapAnalytics({ data }: RoadmapAnalyticsProps) {
  const { roadmap } = data;
  const byPhase = groupByPhase(roadmap.items);
  const avgCompletion =
    roadmap.items.length === 0
      ? 0
      : Math.round(
          roadmap.items.reduce((acc, i) => acc + i.completion_percentage, 0) /
            roadmap.items.length,
        );

  return (
    <DashboardCard
      badge="Roadmap"
      title="Roadmap Analytics"
      caption={`${roadmap.summary.total_items} items · ${roadmap.summary.total_estimated_duration} total duration`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Completion progress</span>
          <span className="font-semibold text-foreground">
            <AnimatedCounter value={avgCompletion} suffix="%" />
          </span>
        </div>
        <ProgressBar
          value={avgCompletion}
          label="Average completion"
          fillClassName="bg-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((phase) => {
          const items = byPhase[phase] ?? [];
          const phaseCompletion =
            items.length === 0
              ? 0
              : Math.round(
                  items.reduce((acc, i) => acc + i.completion_percentage, 0) /
                    items.length,
                );
          return (
            <div
              key={phase}
              className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{phase}</p>
                <AnimatedCounter
                  value={items.length}
                  className="text-sm font-semibold tabular-nums text-muted-foreground"
                />
              </div>
              <ProgressBar value={phaseCompletion} ariaLabel={`${phase} completion`} />
              <p className="text-xs text-muted-foreground">
                {phaseCompletion}% avg completion
              </p>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}

function groupByPhase(items: RoadmapItem[]): Record<string, RoadmapItem[]> {
  const out: Record<string, RoadmapItem[]> = {};
  for (const item of items) {
    if (!out[item.phase]) out[item.phase] = [];
    out[item.phase].push(item);
  }
  return out;
}
