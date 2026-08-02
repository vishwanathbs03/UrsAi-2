"use client";

/**
 * H5.2 — Section 3: Executive Brief.
 *
 * 3–5 sentence deterministic narrative. Reuses the same
 * composition logic the H5.1 Business Digital Twin Brief
 * uses — different presentation, same data source.
 *
 * Answers:
 *   - What is going well?        → strongest analyzer
 *   - What is weak?              → weakest analyzer
 *   - What deserves attention?   → top risk OR top opportunity
 *   - Most important next action → top recommendation
 */

import React from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Sparkles } from "lucide-react";
import type { IntelligenceResponse, IntelligenceAnalyzer } from "@/types/dashboard";
import type { RecommendationsResponse, RecommendationItem } from "@/types/analytics";
import type { OpportunityItem } from "@/types/intelligence";
import type { TwinResponse } from "@/types/analytics";

interface ExecutiveBriefProps {
  twin?: TwinResponse | null;
  intelligence?: IntelligenceResponse | null;
  recommendations?: RecommendationsResponse | null;
}

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

function pickStrongest(a: IntelligenceAnalyzer[] | undefined) {
  if (!a || a.length === 0) return null;
  return [...a].sort((x, y) => y.score - x.score)[0] || null;
}
function pickWeakest(a: IntelligenceAnalyzer[] | undefined) {
  if (!a || a.length === 0) return null;
  return [...a].sort((x, y) => x.score - y.score)[0] || null;
}
function pickTopAction(recs: RecommendationItem[] | undefined): RecommendationItem | null {
  if (!recs || recs.length === 0) return null;
  return [...recs].sort((a, b) => {
    const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (r !== 0) return r;
    return (b.estimated_score_gain || 0) - (a.estimated_score_gain || 0);
  })[0] || null;
}
function pickTopOpp(opps: OpportunityItem[] | undefined): OpportunityItem | null {
  if (!opps || opps.length === 0) return null;
  return [...opps].sort((a, b) => {
    const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (r !== 0) return r;
    return b.estimated_value - a.estimated_value;
  })[0] || null;
}

export const ExecutiveBrief: React.FC<ExecutiveBriefProps> = ({ twin, intelligence, recommendations }) => {
  if (!intelligence) return null;

  const overall = intelligence.overall;
  const score = overall?.score;
  const strongest = pickStrongest(intelligence.analyzers);
  const weakest = pickWeakest(intelligence.analyzers);
  const topOpp = pickTopOpp(intelligence.opportunities?.opportunities);
  const topAction = pickTopAction(recommendations?.recommendations);

  const businessName = twin?.identity?.legal_name || "Your business";
  const sentences: string[] = [];

  if (score != null) {
    sentences.push(
      strongest
        ? `${businessName} currently scores ${score}/100, with ${strongest.title.toLowerCase()} leading at ${strongest.score}/100.`
        : `${businessName} currently scores ${score}/100.`
    );
  } else {
    sentences.push(`${businessName} does not yet have a health score — complete your profile to surface insights.`);
  }

  if (weakest && weakest.key !== strongest?.key) {
    sentences.push(`${weakest.title} is the weakest area at ${weakest.score}/100 and represents the largest single lever for score improvement.`);
  }

  if (topOpp) {
    const v = topOpp.estimated_value > 0 ? ` (scenario estimate)` : "";
    sentences.push(`The most concrete growth path on the table right now is ${topOpp.title.toLowerCase()}${v}.`);
  }

  if (topAction) {
    const gain = topAction.estimated_score_gain > 0 ? `, expected to add ${topAction.estimated_score_gain} points to your health score` : "";
    sentences.push(`The single most important next action is to ${topAction.title.toLowerCase()}${gain}.`);
  }

  const capped = sentences.slice(0, 5);

  return (
    <DashboardCard
      badge="Executive Brief"
      title="What does UrsBiz think is happening?"
      caption="Composed from your live business data. Not a forecast."
      className="border-violet-500/20 bg-violet-500/[0.03] dark:bg-violet-500/[0.06]"
      data-testid="command-center-brief"
    >
      {capped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Complete your business profile to generate the executive brief.</p>
      ) : (
        <ul className="space-y-2">
          {capped.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-500" aria-hidden="true" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
};
