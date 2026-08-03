"use client";

/**
 * Section 9 — AI Business Brief.
 * Short executive narrative answering "What does UrsBiz think
 * is happening in this business right now?" in 3–5 sentences.
 *
 * Composed deterministically from already-fetched data:
 *   - current condition   → intelligence.overall.score / .level
 *   - strongest point     → analyzer with the highest score
 *   - weakest point       → analyzer with the lowest score
 *   - biggest opportunity → intelligence.opportunities.opportunities[0]
 *                           (sorted by priority + estimated_value)
 *   - most important next action → recommendations.recommendations[0]
 *                                  (sorted by priority + score gain)
 *
 * Every visible number is traceable to one of the input props.
 * No fabrication, no scenario language in this section (the
 * inputs are already point estimates; we just narrate them).
 */

import React from "react";
import type {
  IntelligenceResponse,
  IntelligenceAnalyzer,
} from "@/types/dashboard";
import type { TwinResponse } from "@/types/analytics";
import type { RecommendationsResponse, RecommendationItem } from "@/types/analytics";
import type { OpportunityItem } from "@/types/intelligence";

interface AIBusinessBriefProps {
  twin?: TwinResponse | null;
  intelligence?: IntelligenceResponse | null;
  recommendations?: RecommendationsResponse | null;
}

function pickStrongest(analyzers: IntelligenceAnalyzer[] | undefined): IntelligenceAnalyzer | null {
  if (!analyzers || analyzers.length === 0) return null;
  return [...analyzers].sort((a, b) => b.score - a.score)[0] || null;
}

function pickWeakest(analyzers: IntelligenceAnalyzer[] | undefined): IntelligenceAnalyzer | null {
  if (!analyzers || analyzers.length === 0) return null;
  return [...analyzers].sort((a, b) => a.score - b.score)[0] || null;
}

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
const IMPACT_RANK = { High: 0, Medium: 1, Low: 2 } as const;

function pickTopOpportunity(
  opps: OpportunityItem[] | undefined,
): OpportunityItem | null {
  if (!opps || opps.length === 0) return null;
  return [...opps]
    .sort((a, b) => {
      const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (r !== 0) return r;
      const i = (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9);
      if (i !== 0) return i;
      return b.estimated_value - a.estimated_value;
    })[0] || null;
}

function pickTopAction(recs: RecommendationItem[] | undefined): RecommendationItem | null {
  if (!recs || recs.length === 0) return null;
  return [...recs]
    .sort((a, b) => {
      const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (r !== 0) return r;
      return (b.estimated_score_gain || 0) - (a.estimated_score_gain || 0);
    })[0] || null;
}

function levelWord(level: string | undefined | null): string {
  switch ((level || "").toLowerCase()) {
    case "excellent":
      return "excellent";
    case "high":
      return "strong";
    case "medium":
      return "established";
    case "low":
      return "early-stage";
    default:
      return "in transition";
  }
}

export const AIBusinessBrief: React.FC<AIBusinessBriefProps> = ({
  twin,
  intelligence,
  recommendations,
}) => {
  if (!intelligence) return null;

  const overall = intelligence.overall;
  const score = overall?.score ?? null;
  const level = levelWord(overall?.level);

  const strongest = pickStrongest(intelligence.analyzers);
  const weakest = pickWeakest(intelligence.analyzers);

  const topOpp = pickTopOpportunity(intelligence.opportunities?.opportunities);
  const topAction = pickTopAction(recommendations?.recommendations);

  const businessName = twin?.identity?.legal_name || "Your business";

  // Compose the narrative. Every sentence ends with one traceable
  // fact. We deliberately keep the language plain — no jargon.
  const sentences: string[] = [];

  // Sentence 1 — current condition (1 sentence).
  if (score != null) {
    const suffix = strongest
      ? ` with ${strongest.title.toLowerCase()} as the strongest dimension at ${strongest.score}/100`
      : "";
    sentences.push(
      `${businessName} is in a ${level} condition right now, scoring ${score} out of 100${suffix}.`,
    );
  } else {
    sentences.push(`${businessName} is in transition; complete your profile to surface a health score.`);
  }

  // Sentence 2 — strongest vs weakest (1 sentence).
  if (strongest && weakest && strongest.key !== weakest.key) {
    sentences.push(
      `${strongest.title} is leading at ${strongest.score}/100, while ${weakest.title.toLowerCase()} is the weakest at ${weakest.score}/100 and is where the biggest score gain is available.`,
    );
  } else if (weakest) {
    sentences.push(
      `${weakest.title} is currently the weakest dimension at ${weakest.score}/100.`,
    );
  }

  // Sentence 3 — biggest opportunity (1 sentence).
  if (topOpp) {
    // P0.7 — currency is no longer forced to USD. Use the
    // payload's currency or render a neutral label so we never
    // silently assume USD.
    const currency = intelligence.opportunities?.currency ?? null;
    const symbol = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
    const oppVal =
      topOpp.estimated_value > 0
        ? currency
          ? `, with a modelled value of ${symbol}${topOpp.estimated_value.toLocaleString()} ${currency} (scenario estimate, ${
              topOpp.impact.toLowerCase() === "high" ? "if executed" : "subject to execution"
            })`
          : `, with a modelled value of ${topOpp.estimated_value.toLocaleString()} (currency unspecified, scenario estimate, ${
              topOpp.impact.toLowerCase() === "high" ? "if executed" : "subject to execution"
            })`
        : "";
    sentences.push(
      `The biggest opportunity on the table right now is ${topOpp.title.toLowerCase()}${oppVal}.`,
    );
  }

  // Sentence 4 — most important next action (1 sentence).
  if (topAction) {
    // P0.9 — replace "expected to add X points" with explicit
    // "modelled to add up to X points under current rules".
    const gain =
      topAction.estimated_score_gain > 0
        ? `, modelled to add up to ${topAction.estimated_score_gain} points under current rules (based on current data)`
        : "";
    sentences.push(
      `The single most important next action is to ${topAction.title.toLowerCase()}${gain}.`,
    );
  }

  // Cap at 5 sentences even if inputs produce more.
  const capped = sentences.slice(0, 5);

  // If we couldn't compose anything, render a friendly fallback.
  if (capped.length === 0) {
    return (
      <section
        aria-labelledby="twin-section-brief"
        className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Section 9
        </span>
        <h2 id="twin-section-brief" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
          AI Business Brief
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete your business profile to generate the executive brief.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="twin-section-brief"
      data-testid="twin-section-brief"
      className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 shadow-sm sm:p-6"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        Section 9
      </span>
      <h2 id="twin-section-brief" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
        AI Business Brief
      </h2>
      <p className="mt-1 text-xs italic text-muted-foreground">
        Composed from your live business data. Not a forecast.
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-card-foreground">
        {capped.map((s, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
