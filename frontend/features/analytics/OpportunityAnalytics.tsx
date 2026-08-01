"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import type { TwinOpportunityMatrix } from "@/types/analytics";

interface OpportunityAnalyticsProps {
  matrix: TwinOpportunityMatrix;
}

const OPPORTUNITY_SECTIONS: {
  key: keyof TwinOpportunityMatrix;
  label: string;
}[] = [
  { key: "quick_wins", label: "Quick Wins" },
  { key: "strategic_investments", label: "Strategic Investments" },
  { key: "long_term_growth", label: "Long-Term Growth" },
  { key: "export_opportunities", label: "Export Opportunities" },
  { key: "digital_opportunities", label: "Digital Opportunities" },
];

/**
 * Opportunity analytics — five opportunity buckets from the
 * Digital Twin opportunity matrix.
 */
export function OpportunityAnalytics({ matrix }: OpportunityAnalyticsProps) {
  return (
    <DashboardCard
      badge="Opportunities"
      title="Opportunity Analytics"
      caption="Ranked opportunities from recommendations and roadmap items."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {OPPORTUNITY_SECTIONS.map(({ key, label }) => {
          const items = matrix[key];
          const avgRoi =
            items.length === 0
              ? 0
              : Math.round(
                  items.reduce((acc, i) => acc + i.estimated_roi, 0) / items.length,
                );
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3"
            >
              <p className="text-sm font-medium text-foreground">{label}</p>
              <AnimatedCounter
                value={items.length}
                className="text-2xl font-semibold text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Avg ROI {avgRoi}%
              </p>
              {items.length > 0 && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {items[0].title}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
