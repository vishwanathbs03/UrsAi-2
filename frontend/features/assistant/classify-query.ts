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
 *
 * Decision intents (decision_*, action_plan) are tested before
 * topic intents so that "Should I hire?" routes to decision_hire
 * instead of the more general hiring topic.
 */

import type { QueryKind } from "./types";

interface Rule {
  kind: QueryKind;
  /** Phrases that, if any are present, route to this kind. */
  phrases: readonly string[];
}

const RULES: readonly Rule[] = [
  // --- Decision intents take priority ------------------------------- //
  {
    kind: "decision_hire",
    phrases: [
      "should i hire",
      "should i recruit",
      "hire someone",
      "do i need to hire",
      "is it time to hire",
      "first hire",
    ],
  },
  {
    kind: "decision_expand",
    phrases: [
      "should i expand",
      "should i scale",
      "should i go global",
      "expand my business",
      "open new branch",
    ],
  },
  {
    kind: "decision_loan",
    phrases: [
      "should i apply for a loan",
      "should i take a loan",
      "apply for loan",
      "take a loan",
      "borrow money",
      "should i borrow",
    ],
  },
  {
    kind: "action_plan",
    phrases: [
      "action plan",
      "weekly plan",
      "monthly plan",
      "step by step",
      "step-by-step plan",
      "how do i implement",
      "implementation plan",
    ],
  },

  // --- Topic intents ----------------------------------------------- //
  {
    kind: "growth_strategy",
    phrases: [
      "grow my business",
      "grow my revenue",
      "grow",
      "business growth",
      "how do i grow",
      "scaling strategy",
      "growth strategy",
      "growth plan",
      "revenue growth",
      "increase revenue",
    ],
  },
  {
    kind: "digital_transformation",
    phrases: [
      "digitise",
      "digitize",
      "digital transformation",
      "go online",
      "online presence",
      "digital strategy",
      "modernise",
      "modernize",
      "adopt technology",
      "automate",
    ],
  },
  {
    kind: "finance",
    phrases: [
      "raise capital",
      "raise funding",
      "capital",
      "finance",
      "financial plan",
      "working capital",
      "cash flow",
      "cashflow",
      "funding",
      "loan options",
      "money",
    ],
  },
  {
    kind: "gst",
    phrases: [
      "gst",
      "goods and services tax",
      "tax registration",
      "gst registration",
      "gst return",
      "gstr",
      "input tax credit",
      "itc",
    ],
  },
  {
    kind: "government_schemes",
    phrases: [
      "government scheme",
      "govt scheme",
      "pmegp",
      "cgtmse",
      "mudra",
      "udyam",
      "subsidy",
      "msme scheme",
      "scheme",
      "startup india",
    ],
  },
  {
    kind: "marketing",
    phrases: [
      "marketing",
      "customer acquisition",
      "lead generation",
      "lead gen",
      "branding",
      "social media",
      "seo",
      "sem",
      "advertising",
      "campaign",
      "b2b customers",
      "b2c customers",
      "b2b marketing",
      "b2c marketing",
      "get more customers",
      "how do i get customers",
      "how to get customers",
    ],
  },
  {
    kind: "operations",
    phrases: [
      "operations",
      "inventory",
      "supply chain",
      "ops",
      "processes",
      "sop",
      "logistics",
      "warehouse",
    ],
  },
  {
    kind: "hiring",
    phrases: [
      "hiring",
      "new hire",
      "recruit",
      "talent",
      "candidate",
      "interview",
      "salary",
      "compensation",
      "team",
      "employee",
    ],
  },
  {
    kind: "compliance",
    phrases: [
      "compliance",
      "regulatory",
      "roc filing",
      "annual return",
      "legal",
      "licence",
      "license",
      "kyc",
      "aml",
      "msme registration",
    ],
  },
  {
    kind: "risk",
    phrases: [
      "risk",
      "risks",
      "threats",
      "risk register",
      "risk management",
      "insurance",
      "fire insurance",
      "cybersecurity risk",
      "operational risk",
    ],
  },
  {
    kind: "scaling",
    phrases: [
      "scale",
      "scaling",
      "expand",
      "expansion",
      "new geography",
      "new market",
      "international",
      "global expansion",
    ],
  },

  // --- Explain / meta intents -------------------------------------- //
  {
    kind: "improve_business",
    phrases: [
      "improve my business",
      "how can i improve",
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
      "what should i do this month",
      "what to do this month",
      "do this month",
      "this month",
      "this quarter",
    ],
  },
  // P1.6 — product-help intent comes BEFORE export_opportunities so
  // "export this conversation" doesn't collide with "export
  // readiness". Phrases aim only at UrsBiz feature questions
  // (export conversation / PDF / report / profile / analytics /
  // scheme finder / plan / notifications).
  {
    kind: "product_help",
    phrases: [
      "how do i export this conversation",
      "how do i export this chat",
      "export this conversation",
      "export this chat",
      "download this conversation",
      "download conversation",
      "how do i generate a pdf",
      "how do i generate pdf",
      "generate a pdf",
      "create a pdf",
      "pdf report",
      "where can i find my report",
      "where do i find my report",
      "where is my report",
      "how do i update my business profile",
      "update business profile",
      "edit business profile",
      "how do i use analytics",
      "how to use analytics",
      "where is analytics",
      "how do i find schemes",
      "where are schemes",
      "find government schemes",
      "how do i change my plan",
      "change plan",
      "upgrade plan",
      "how do i share",
      "share my dashboard",
      "share my report",
      "where are notifications",
      "how do notifications work",
    ],
  },

  // P1.3 — growth-target phrases take precedence over the generic
  // growth strategy bucket when the prompt is explicitly
  // target-shaped (e.g. "grow from ₹1.5 Cr to ₹3 Cr").
  {
    kind: "growth_target",
    phrases: [
      "from ₹",
      "to ₹",
      "reach ₹",
      "target ₹",
      "grow to ₹",
      "grow from",
      "achieve ₹",
      "hit ₹",
      "double the revenue",
      "10x revenue",
    ],
  },

  {
    kind: "export_opportunities",
    phrases: [
      "export opportunity",
      "export opportunities",
      "export readiness",
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
