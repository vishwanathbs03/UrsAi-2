"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { EmptyState } from "@/components/common/EmptyState";
import { InsightCard } from "./InsightCard";
import type { InsightItem } from "./use-insights-data";

interface InsightsListProps {
  insights: InsightItem[];
  totalCount: number;
  onOpen: (insight: InsightItem) => void;
}

/**
 * Responsive grid of InsightCards. 1 column on mobile, 2 on
 * lg+. Shows an EmptyState when filters narrow the list to
 * zero so the user knows it's the filter, not a missing
 * data source.
 */
export function InsightsList({
  insights,
  totalCount,
  onOpen,
}: InsightsListProps) {
  if (insights.length === 0) {
    return (
      <DashboardCard badge="Insights" title="No insights match">
        <EmptyState
          illustration="lightbulb"
          title="No insights to show"
          description={
            totalCount === 0
              ? "The AI engine has not produced any insights yet — try refreshing the analysis."
              : "Try clearing one of the filters to widen the search."
          }
          actionLabel="Refresh analysis"
          onAction={() => { if (typeof window !== "undefined") window.location.href = "/insights"; }}
        />
      </DashboardCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        aria-live="polite"
      >
        {insights.length} of {totalCount} insight
        {totalCount === 1 ? "" : "s"} match the active filters
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
