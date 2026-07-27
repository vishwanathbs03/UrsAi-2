"use client";

import { Lightbulb, ShieldAlert, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type {
  RecommendationItem,
  TwinOpportunityEntry,
  TwinRiskEntry,
  TwinResponse,
} from "@/types/analytics";
import { applyPredictiveFilters, type PredictiveFilters } from "./use-predictive-filters";

interface WhatDrivesGrowthProps {
  twin: TwinResponse;
  recommendations: RecommendationItem[];
  filters: PredictiveFilters;
}

/**
 * What Drives Growth — three side-by-side panels that
 * surface the highest-impact items the engine already
 * produced:
 *
 *   - Top Opportunities: top 5 by estimated_roi from
 *     twin.opportunity_matrix (all 6 buckets flattened).
 *   - Top Risks: top 5 by estimated_impact from the active
 *     buckets of twin.risk_matrix (critical / high / medium,
 *     in that order of severity).
 *   - Highest ROI Recommendations: top 5 by estimated_roi
 *     from recommendations.recommendations, after the user-
 *     selected category / priority filters have been applied.
 *
 * No re-scoring. No inference. The lists are sorted
 * server-side data, sliced client-side.
 */
export function WhatDrivesGrowth({
  twin,
  recommendations,
  filters,
}: WhatDrivesGrowthProps) {
  const topOpps = topNBy<TwinOpportunityEntry>(
    flattenOpportunities(twin),
    (o) => o.estimated_roi,
    5,
  );
  const topRisks = topNBy<TwinRiskEntry>(
    [
      ...twin.risk_matrix.critical_risks,
      ...twin.risk_matrix.high_risks,
      ...twin.risk_matrix.medium_risks,
    ],
    (r) => r.estimated_impact,
    5,
  );
  const filteredRecs = applyPredictiveFilters(recommendations, filters);
  const topRecs = topNBy<RecommendationItem>(
    filteredRecs,
    (r) => r.estimated_roi,
    5,
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <OpportunitiesPanel items={topOpps} />
      <RisksPanel items={topRisks} />
      <RecommendationsPanel items={topRecs} />
    </div>
  );
}

interface OpportunitiesPanelProps {
  items: TwinOpportunityEntry[];
}

function OpportunitiesPanel({ items }: OpportunitiesPanelProps) {
  return (
    <DashboardCard
      badge="Opportunities"
      title="Top Opportunities"
      caption="Highest-ROI opportunities from the Digital Twin."
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No opportunities detected.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((o) => (
            <li
              key={o.opportunity_id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/20 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Lightbulb
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <p className="truncate font-medium text-foreground">
                    {o.title}
                  </p>
                </div>
                <LevelBadge
                  level={o.priority}
                  tone={levelToTone(o.priority)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {o.phase} · est. ROI {o.estimated_roi}% · score gain{" "}
                {o.estimated_score_gain}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

interface RisksPanelProps {
  items: TwinRiskEntry[];
}

function RisksPanel({ items }: RisksPanelProps) {
  return (
    <DashboardCard
      badge="Risks"
      title="Top Risks"
      caption="Active risks sorted by estimated impact."
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active risks detected.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li
              key={r.risk_id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/20 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldAlert
                    className="mt-0.5 size-3.5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p className="truncate font-medium text-foreground">
                    {r.title}
                  </p>
                </div>
                <LevelBadge
                  level={r.priority}
                  tone={levelToTone(r.priority)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {r.category} · impact {r.estimated_impact}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

interface RecommendationsPanelProps {
  items: RecommendationItem[];
}

function RecommendationsPanel({ items }: RecommendationsPanelProps) {
  return (
    <DashboardCard
      badge="Recommendations"
      title="Highest ROI Recommendations"
      caption="Top recommendations sorted by estimated ROI."
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recommendations match the active filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/20 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <TrendingUp
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <p className="truncate font-medium text-foreground">
                    {r.title}
                  </p>
                </div>
                <LevelBadge
                  level={r.priority}
                  tone={levelToTone(r.priority)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {r.phase} · est. ROI {r.estimated_roi}% · score gain{" "}
                {r.estimated_score_gain}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function topNBy<T>(items: T[], score: (t: T) => number, n: number): T[] {
  return [...items]
    .sort((a, b) => (score(b) || 0) - (score(a) || 0))
    .slice(0, n);
}

function flattenOpportunities(twin: TwinResponse): TwinOpportunityEntry[] {
  const m = twin.opportunity_matrix;
  return [
    ...m.quick_wins,
    ...m.strategic_investments,
    ...m.long_term_growth,
    ...m.export_opportunities,
    ...m.digital_opportunities,
    ...m.funding_opportunities,
  ];
}
