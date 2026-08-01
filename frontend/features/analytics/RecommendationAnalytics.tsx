"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import type { RecommendationItem } from "@/types/analytics";
import {
  countByCategory,
  countByPriority,
  sumImpact,
  sumRoi,
} from "./use-analytics-filters";

interface RecommendationAnalyticsProps {
  items: RecommendationItem[];
  totalCount: number;
}

/**
 * Recommendation analytics — priority/category breakdowns
 * plus estimated total ROI and business impact.
 */
export function RecommendationAnalytics({
  items,
  totalCount,
}: RecommendationAnalyticsProps) {
  const byPriority = countByPriority(items);
  const byCategory = countByCategory(items);
  const totalRoi = sumRoi(items);
  const totalImpact = sumImpact(items);

  return (
    <DashboardCard
      badge="Recommendations"
      title="Recommendation Analytics"
      caption={`${items.length} of ${totalCount} recommendations match the active filters.`}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            By priority
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
              <StatChip key={p} label={p} value={byPriority[p]} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Totals
          </p>
          <div className="grid grid-cols-2 gap-2">
            <StatChip label="Est. total ROI" value={totalRoi} suffix="%" large />
            <StatChip label="Est. total impact" value={totalImpact} large />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          By category
        </p>
        {Object.keys(byCategory).length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations match filters.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(byCategory)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([label, count]) => (
                <li
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span className="truncate text-foreground">{label}</span>
                  <AnimatedCounter value={count} className="font-semibold tabular-nums" />
                </li>
              ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}

function StatChip({
  label,
  value,
  suffix,
  large,
}: {
  label: string;
  value: number;
  suffix?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-center">
      <AnimatedCounter
        value={value}
        suffix={suffix}
        className={large ? "text-xl font-semibold text-foreground" : "text-lg font-semibold text-foreground"}
      />
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
