/**
 * Deterministic query classifier.
 *
 * The assistant never makes a network call to "understand" the
 * user's prompt. Instead, every user message is matched against
 * a small keyword set to produce a `QueryKind`, which then
 * routes to a dedicated deterministic builder in `builder.ts`.
 *
 * The match is case-insensitive and looks at the literal prompt
 * text. Order of checks matters: the first matching kind wins.
 * If no kind matches, `fallback` is returned — the fallback
 * builder is a general overview, not an error.
 */

import type { QueryKind } from "./types";

interface Rule {
  kind: QueryKind;
  /** Phrases that, if any are present, route to this kind. */
  phrases: readonly string[];
}

const RULES: readonly Rule[] = [
  {
    kind: "improve_business",
    phrases: [
      "improve my business",
      "how can i improve",
      "grow my business",
      "what should i work on",
      "what can i do better",
      "how to improve",
      "improvement",
    ],
  },
  {
    kind: "low_score",
    phrases: [
      "why is my score low",
      "low score",
      "score is low",
      "why low",
      "raise my score",
      "boost my score",
      "increase my score",
      "score is down",
    ],
  },
  {
    kind: "what_first",
    phrases: [
      "what should i do first",
      "where do i start",
      "what to do first",
      "first step",
      "first action",
      "starting point",
      "first thing",
      "next step",
    ],
  },
  {
    kind: "export_opportunities",
    phrases: [
      "export opportunity",
      "export opportunities",
      "export readiness",
      "international",
      "going global",
      "overseas",
      "export market",
      "export",
    ],
  },
  {
    kind: "business_dna",
    phrases: [
      "business dna",
      "my dna",
      "dna match",
      "archetype",
      "what kind of business am i",
      "explain my business",
      "what is my business",
    ],
  },
  {
    kind: "explain_roadmap",
    phrases: [
      "explain roadmap",
      "explain the roadmap",
      "what is the roadmap",
      "tell me about the roadmap",
      "roadmap plan",
      "explain your plan",
    ],
  },
  {
    kind: "explain_recommendations",
    phrases: [
      "explain recommendations",
      "explain the recommendations",
      "what are the recommendations",
      "recommendations explain",
      "tell me about the recommendations",
    ],
  },
  {
    kind: "explain_insights",
    phrases: [
      "explain insights",
      "explain the insights",
      "what are the insights",
      "insights explain",
      "tell me about the insights",
    ],
  },
  {
    kind: "explain_rules",
    phrases: [
      "explain rules",
      "explain the rules",
      "what are the rules",
      "rule firings",
      "active rules",
      "tell me about the rules",
    ],
  },
  {
    kind: "general_overview",
    phrases: [
      "overview",
      "summary",
      "status",
      "give me the big picture",
      "how is my business doing",
      "how is everything",
      "status update",
    ],
  },
];

/**
 * Match the user prompt to a `QueryKind`. The match is
 * case-insensitive and works against the literal prompt — no
 * LLM, no embedding, no remote call.
 */
export function classifyQuery(prompt: string): QueryKind {
  const text = prompt.trim().toLowerCase();
  if (text.length === 0) return "fallback";
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (text.includes(phrase)) {
        return rule.kind;
      }
    }
  }
  return "fallback";
}
