"use client";

import { useMemo } from "react";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { CircularScore } from "@/components/dashboard/CircularScore";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { DnaArchetype, DnaResponse } from "@/types/dashboard";
import type { ActionCardItem } from "./use-action-board-data";
import type { ActionStatus } from "./use-action-status-storage";

interface BusinessJourneyPreviewProps {
  dna: DnaResponse | null;
  cards: ActionCardItem[];
  statuses: Record<string, ActionStatus>;
  /** Current overall business score, used to compute the
   *  projected score for the "after" half of the journey. */
  currentScore: number | null;
}

/**
 * Business Journey preview — a small before/after strip
 * showing the user's current Business DNA archetype vs a
 * "projected" DNA once the in-progress and completed
 * actions land.
 *
 * The "current" side reads from the DNA response
 * (archetype, match score). The "projected" side is
 * computed client-side from the same actions used by the
 * summary panel:
 *  - projected score  = current score + sum of expected
 *    score improvements on completed + 0.5 * in-progress
 *  - projected band   = the level matching the projected
 *    score using the same banding rule as the scores
 *    service (Low / Medium / High / Excellent)
 *  - projected archetype = the rule-engine category with
 *    the highest impact in the user's in-progress +
 *    completed actions, mapped to an archetype label
 *
 * Sprint 4: this is intentionally a *preview* — the
 * heuristic is documented inline. A real projected-DNA
 * service would call the DNA engine with simulated
 * profile changes, which is out of scope this milestone.
 */
export function BusinessJourneyPreview({
  dna,
  cards,
  statuses,
  currentScore,
}: BusinessJourneyPreviewProps) {
  const current = useMemo(() => buildCurrent(dna, currentScore), [dna, currentScore]);
  const projected = useMemo(
    () => buildProjected(dna, cards, statuses, currentScore),
    [dna, cards, statuses, currentScore],
  );

  return (
    <DashboardCard
      badge="Journey"
      title="Business Journey preview"
      caption="Where your business is today vs where the in-progress actions could take it."
      compact
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <JourneySide
          label="Current"
          archetypeTitle={current.archetypeTitle}
          archetypeKey={current.archetypeKey}
          matchScore={current.matchScore}
          score={currentScore}
          tone="text-foreground"
        />
        <ArrowRight
          className="hidden size-5 text-muted-foreground sm:block"
          aria-hidden="true"
        />
        <JourneySide
          label="Projected"
          archetypeTitle={projected.archetypeTitle}
          archetypeKey={projected.archetypeKey}
          matchScore={projected.matchScore}
          score={projected.score}
          tone="text-emerald-700"
          accent
        />
      </div>
      {projected.lift > 0 && currentScore !== null && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
          <TrendingUp className="size-3" aria-hidden="true" />
          Projected lift +
          <AnimatedCounter value={Math.round(projected.lift)} durationMs={500} /> points
        </p>
      )}
    </DashboardCard>
  );
}

interface JourneySide {
  label: string;
  archetypeTitle: string;
  archetypeKey: string;
  matchScore: number;
  score: number | null;
  tone: string;
  accent?: boolean;
}

function JourneySide({
  label,
  archetypeTitle,
  archetypeKey,
  matchScore,
  score,
  tone,
  accent,
}: JourneySide) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-border ${accent ? "border-emerald-200 bg-emerald-50/40" : "bg-secondary/30"} p-3`}
    >
      <CircularScore
        value={score ?? matchScore}
        size={84}
        thickness={8}
        caption={levelForScore(score ?? matchScore)}
        ariaLabel={`${label} business score`}
        fillClassName={accent ? "stroke-emerald-500" : "stroke-primary"}
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`truncate text-sm font-semibold ${tone}`}>
          {archetypeTitle}
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {archetypeKey}
        </span>
        {score !== null && (
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            Score <AnimatedCounter value={Math.round(score)} durationMs={400} />/100
          </span>
        )}
        <div className="mt-1">
          <LevelBadge
            level={`${Math.round(matchScore)}% match`}
            tone={levelToTone(
              matchScore >= 70 ? "high" : matchScore >= 40 ? "medium" : "low",
            )}
          />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

interface Journey {
  archetypeTitle: string;
  archetypeKey: string;
  matchScore: number;
  score: number | null;
  lift: number;
}

function buildCurrent(dna: DnaResponse | null, currentScore: number | null): Journey {
  if (!dna?.dna?.archetype) {
    return {
      archetypeTitle: "Awaiting analysis",
      archetypeKey: "—",
      matchScore: 0,
      score: currentScore,
      lift: 0,
    };
  }
  const a = dna.dna.archetype;
  return {
    archetypeTitle: a.title,
    archetypeKey: a.key,
    matchScore: a.match_score,
    score: currentScore,
    lift: 0,
  };
}

function buildProjected(
  dna: DnaResponse | null,
  cards: ActionCardItem[],
  statuses: Record<string, ActionStatus>,
  currentScore: number | null,
): Journey {
  if (currentScore === null) {
    return {
      archetypeTitle: "Awaiting analysis",
      archetypeKey: "—",
      matchScore: 0,
      score: null,
      lift: 0,
    };
  }
  // Projected score: completed + 0.5*in-progress expected
  // score improvements, capped at 100. The rule that an
  // individual action can contribute at most 25 is
  // enforced in use-action-board-data.ts.
  let lift = 0;
  for (const c of cards) {
    const s = statuses[c.id] ?? "todo";
    if (s === "completed") lift += c.expectedScoreImprovement;
    else if (s === "in_progress") lift += c.expectedScoreImprovement * 0.5;
  }
  const projectedScore = Math.min(100, currentScore + lift);

  // Projected archetype: pick the rule-engine category
  // whose completed + in-progress cards have the largest
  // aggregate estimated impact. If no actions are
  // committed, the projected archetype matches the
  // current one.
  const byCategory: Record<string, number> = {};
  for (const c of cards) {
    const s = statuses[c.id] ?? "todo";
    if (s === "completed" || s === "in_progress") {
      byCategory[c.categoryKey] = (byCategory[c.categoryKey] ?? 0) + c.estimatedBusinessImpact;
    }
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
  const current = dna?.dna?.archetype;
  const projectedArchetype = topCategory
    ? archetypeForCategory(topCategory)
    : current ?? null;
  const projectedTitle = projectedArchetype?.title ?? current?.title ?? "No change";
  const projectedKey = projectedArchetype?.key ?? current?.key ?? "—";
  const projectedMatch = current
    ? Math.min(100, current.match_score + Math.round(lift * 0.6))
    : 0;

  return {
    archetypeTitle: projectedTitle,
    archetypeKey: projectedKey,
    matchScore: projectedMatch,
    score: Math.round(projectedScore),
    lift,
  };
}

function levelForScore(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 55) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

/**
 * Heuristic mapping from rule-engine category to a
 * business-DNA-style archetype. Stable, no AI — the
 * mapping is documented in the code so the next agent
 * can adjust it without guesswork. Categories that have
 * no obvious match fall through to a generic "Strategic
 * Builder" label.
 */
function archetypeForCategory(categoryKey: string): DnaArchetype | null {
  const map: Record<string, DnaArchetype> = {
    immediate_actions: {
      key: "operational_fixer",
      title: "Operational Fixer",
      match_score: 70,
    },
    high_priority: {
      key: "growth_operator",
      title: "Growth Operator",
      match_score: 70,
    },
    medium_priority: {
      key: "steady_builder",
      title: "Steady Builder",
      match_score: 60,
    },
    long_term: {
      key: "long_horizon_planner",
      title: "Long-Horizon Planner",
      match_score: 60,
    },
    risk_alerts: {
      key: "risk_reducer",
      title: "Risk Reducer",
      match_score: 70,
    },
    compliance_actions: {
      key: "compliance_champion",
      title: "Compliance Champion",
      match_score: 70,
    },
    export_readiness_actions: {
      key: "export_pathfinder",
      title: "Export Pathfinder",
      match_score: 70,
    },
    digital_transformation_actions: {
      key: "digital_pioneer",
      title: "Digital Pioneer",
      match_score: 70,
    },
  };
  return map[categoryKey] ?? null;
}
