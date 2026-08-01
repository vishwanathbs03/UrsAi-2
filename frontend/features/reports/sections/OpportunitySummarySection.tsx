"use client";

import { ReportSection } from "../ReportSection";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "opportunity-summary",
  id: "report-opportunity-summary",
  badge: "Opportunities",
  title: "Opportunity Summary",
  caption: "Opportunity buckets from the Digital Twin matrix.",
};

interface OpportunitySummarySectionProps {
  data: ReportsData;
}

const BUCKETS = [
  { key: "quick_wins", label: "Quick Wins" },
  { key: "strategic_investments", label: "Strategic Investments" },
  { key: "long_term_growth", label: "Long-Term Growth" },
  { key: "export_opportunities", label: "Export Opportunities" },
  { key: "digital_opportunities", label: "Digital Opportunities" },
] as const;

/**
 * Opportunity Summary — five opportunity buckets with
 * count + average ROI. Pulled from the Digital Twin
 * opportunity matrix.
 */
export function OpportunitySummarySection({ data }: OpportunitySummarySectionProps) {
  const matrix = data.twin.opportunity_matrix;
  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BUCKETS.map(({ key, label }) => {
          const items = matrix[key] ?? [];
          const avgRoi =
            items.length === 0
              ? 0
              : Math.round(
                  items.reduce((acc, i) => acc + i.estimated_roi, 0) /
                    items.length,
                );
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
            >
              <p className="text-sm font-medium text-foreground">{label}</p>
              <span className="text-2xl font-semibold text-foreground">
                <AnimatedCounter value={items.length} />
              </span>
              <p className="text-xs text-muted-foreground">Avg ROI {avgRoi}%</p>
              {items.length > 0 && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {items[0].title}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}
