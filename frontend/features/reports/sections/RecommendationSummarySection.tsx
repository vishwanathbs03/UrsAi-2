"use client";

import { ReportSection } from "../ReportSection";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import {
  ACTION_CATEGORY_LABELS,
} from "@/features/action-board/use-action-board-data";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";
import type { RuleCategory } from "@/types/dashboard";

const META: ReportSectionMeta = {
  key: "recommendation-summary",
  id: "report-recommendation-summary",
  badge: "Recommendations",
  title: "Recommendation Summary",
  caption: "Top recommendations and aggregate ROI / impact.",
};

interface RecommendationSummarySectionProps {
  data: ReportsData;
}

const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

/**
 * Recommendation Summary — the four priority buckets, the
 * top five by priority, and aggregate ROI / impact figures.
 * No derivation; every value is in the upstream payload.
 */
export function RecommendationSummarySection({ data }: RecommendationSummarySectionProps) {
  const { summary, recommendations } = data.recommendations;

  const byPriority = PRIORITIES.map(
    (p) => recommendations.filter((r) => r.priority === p).length,
  );

  // By category — count and label
  const byCategoryMap = new Map<string, number>();
  for (const r of recommendations) {
    const label =
      ACTION_CATEGORY_LABELS[r.category as RuleCategory] ?? r.category;
    byCategoryMap.set(label, (byCategoryMap.get(label) ?? 0) + 1);
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Top by priority
  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
  const top = [...recommendations]
    .sort(
      (a, b) =>
        order[a.priority as keyof typeof order] -
        order[b.priority as keyof typeof order],
    )
    .slice(0, 5);

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRIORITIES.map((p, i) => (
          <div
            key={p}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/30 px-3 py-3 text-center"
          >
            <span className="text-2xl font-semibold text-foreground">
              <AnimatedCounter value={byPriority[i]} />
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {p}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AggregateStat
          label="Total est. ROI"
          value={`${summary.total_estimated_roi}%`}
        />
        <AggregateStat
          label="Total est. impact"
          value={summary.total_estimated_impact.toLocaleString()}
        />
        <AggregateStat
          label="Total est. score gain"
          value={summary.total_estimated_score_gain.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            By category
          </p>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recommendations.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {byCategory.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-xs"
                >
                  <span className="truncate text-foreground">{c.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    <AnimatedCounter value={c.count} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Top by priority
          </p>
          {top.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recommendations.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {top.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-xs"
                >
                  <span className="truncate font-medium text-foreground">
                    {r.title}
                  </span>
                  <LevelBadge
                    level={r.priority}
                    tone={levelToTone(r.priority)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ReportSection>
  );
}

function AggregateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
