"use client";

import { ReportSection } from "../ReportSection";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { ACTION_CATEGORY_LABELS } from "@/features/action-board/use-action-board-data";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "rule-summary",
  id: "report-rule-summary",
  badge: "Rules",
  title: "Rule Summary",
  caption: "Engine firings by priority and category.",
};

interface RuleSummarySectionProps {
  data: ReportsData;
}

const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
type RuleCategoryKey = keyof typeof ACTION_CATEGORY_LABELS;

/**
 * Rule Summary — by-priority and by-category counts plus the
 * top firings table. The category counts and labels come
 * directly from the upstream payload, never re-derived.
 */
export function RuleSummarySection({ data }: RuleSummarySectionProps) {
  const { summary, categories } = data.rules;

  // Flatten firings and tally by priority / category.
  const flat: { id: string; title: string; priority: string; category: string }[] = [];
  for (const [catKey, block] of Object.entries(categories)) {
    if (!block || !Array.isArray(block.firings)) continue;
    for (const f of block.firings) {
      flat.push({ id: f.id, title: f.title, priority: f.priority, category: catKey });
    }
  }

  const byPriority = PRIORITIES.map(
    (p) => flat.filter((f) => f.priority === p).length,
  );
  const byCategory = Object.entries(categories)
    .map(([k, v]) => ({
      key: k,
      label: ACTION_CATEGORY_LABELS[k as RuleCategoryKey] ?? k,
      count: v?.firing_count ?? 0,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const topFirings = [...flat]
    .sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
      return order[a.priority as keyof typeof order] - order[b.priority as keyof typeof order];
    })
    .slice(0, 10);

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            By category
          </p>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No firings.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {byCategory.map((c) => (
                <li
                  key={c.key}
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
            Engine totals
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Total firings</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">
              {summary.total_firings}
            </dd>
            <dt className="text-muted-foreground">Categories with firings</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">
              {summary.categories_with_firings}
            </dd>
            <dt className="text-muted-foreground">Categories evaluated</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">
              {summary.categories_evaluated}
            </dd>
            <dt className="text-muted-foreground">Total est. impact</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">
              {summary.total_estimated_impact}
            </dd>
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Top firings
        </p>
        {topFirings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rule firings.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {topFirings.map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-foreground">
                  {f.title}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {f.category}
                  </span>
                  <LevelBadge
                    level={f.priority}
                    tone={levelToTone(f.priority)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReportSection>
  );
}
