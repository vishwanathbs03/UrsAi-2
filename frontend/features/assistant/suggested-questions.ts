/**
 * Suggested questions shown as clickable chips in the
 * AI Business Assistant UI. Frontend only. Each chip is
 * paired with the `QueryKind` it routes to, so a click
 * runs the same deterministic builder the prompt box would.
 *
 * The seven chips match the seven example questions in the
 * Sprint 7 Part 1 spec. Order is intentional: high-leverage
 * intros first, then specific explanations, then broad.
 */

import type { SuggestedQuestion } from "./types";

export const SUGGESTED_QUESTIONS: readonly SuggestedQuestion[] = [
  {
    id: "improve_business",
    text: "Improve my business.",
    kind: "improve_business",
  },
  {
    id: "increase_revenue",
    text: "Increase revenue.",
    kind: "improve_business",
  },
  {
    id: "funding_advice",
    text: "Funding advice.",
    kind: "what_first",
  },
  {
    id: "growth_strategy",
    text: "Growth strategy.",
    kind: "explain_roadmap",
  },
  {
    id: "risk_analysis",
    text: "Risk analysis.",
    kind: "low_score",
  },
  {
    id: "business_dna",
    text: "Explain my Business DNA.",
    kind: "business_dna",
  },
  {
    id: "explain_recommendations",
    text: "Explain recommendations.",
    kind: "explain_recommendations",
  },
];

/** Returns the chip whose `id` matches, or `null`. */
export function findSuggestedQuestion(
  id: string,
): SuggestedQuestion | null {
  for (const q of SUGGESTED_QUESTIONS) {
    if (q.id === id) return q;
  }
  return null;
}

/** Returns the chip whose `kind` matches, or `null`. */
export function findSuggestedQuestionByKind(
  kind: SuggestedQuestion["kind"],
): SuggestedQuestion | null {
  for (const q of SUGGESTED_QUESTIONS) {
    if (q.kind === kind) return q;
  }
  return null;
}
