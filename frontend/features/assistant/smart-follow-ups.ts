/**
 * Smart follow-ups — Sprint H4 Module 6.
 *
 * Produces three deterministic "follow-up" question chips for
 * every assistant answer. Pure functions of the QueryKind and
 * (optionally) the recent memory topics.
 *
 * Examples:
 *   - PMEGP question -> ["Check Eligibility", "Compare with Mudra",
 *                         "Required Documents", "Timeline"]
 *   - GST question   -> ["Costs", "Deadline", "Penalty"]
 *
 * The orchestrator's "Next Questions" section is the same set,
 * just embedded inline. The chips above the prompt bar reuse
 * the same derivation so the two channels stay in sync.
 */

import type { QueryKind } from "./types";

export interface SmartFollowUp {
  id: string;
  label: string;
  /** The QueryKind the chip routes to when clicked. */
  routesTo: QueryKind;
  /** Suggested free-text prompt to surface in the input. */
  prompt: string;
  /** Whether this chip should be flagged as contextual (came from memory). */
  contextual?: boolean;
}

const FALLBACK: SmartFollowUp[] = [
  {
    id: "summary",
    label: "Give me a one-line summary",
    routesTo: "general_overview",
    prompt: "Give me a one-line summary of my business.",
  },
  {
    id: "actions",
    label: "What should I do first?",
    routesTo: "what_first",
    prompt: "What should I do first this week?",
  },
  {
    id: "risks",
    label: "Walk through my risks",
    routesTo: "risk",
    prompt: "Walk me through my biggest risks.",
  },
];

export function buildSmartFollowUps(
  kind: QueryKind,
  recentTopics: string[] = [],
): SmartFollowUp[] {
  const list = PRIMARY[kind];
  if (!list) return FALLBACK.slice(0, 3);
  // Avoid duplicating the topic the user just asked about.
  const filtered = list.filter((f) => f.label !== recentTopics[0]);
  // Always emit three; if the catalog has fewer, pad from fallback.
  if (filtered.length >= 3) return filtered.slice(0, 3);
  const padded = [...filtered];
  for (const f of FALLBACK) {
    if (padded.length >= 3) break;
    if (padded.some((p) => p.id === f.id)) continue;
    padded.push(f);
  }
  return padded.slice(0, 3);
}

const PRIMARY: Partial<Record<QueryKind, SmartFollowUp[]>> = {
  improve_business: [
    {
      id: "ib-quick-win",
      label: "Give me a quick win",
      routesTo: "what_first",
      prompt: "Give me the fastest quick-win I can ship this week.",
    },
    {
      id: "ib-budget",
      label: "What can I do with a small budget?",
      routesTo: "growth_strategy",
      prompt: "What can I do this quarter with a small budget?",
    },
    {
      id: "ib-deadline",
      label: "Which action is fastest?",
      routesTo: "operations",
      prompt: "Which of my recommendations has the shortest timeline?",
    },
  ],
  low_score: [
    {
      id: "ls-quick-win",
      label: "Show me a quick win",
      routesTo: "what_first",
      prompt: "Show me a quick win to lift my score.",
    },
    {
      id: "ls-rule",
      label: "Why is my score low?",
      routesTo: "risk",
      prompt: "Why is my business score low?",
    },
    {
      id: "ls-roadmap",
      label: "Walk me through the roadmap",
      routesTo: "explain_roadmap",
      prompt: "Walk me through my roadmap.",
    },
  ],
  growth_strategy: [
    {
      id: "gs-channel",
      label: "Best growth channel for me",
      routesTo: "marketing",
      prompt: "Which growth channel is best for my business?",
    },
    {
      id: "gs-export",
      label: "Export opportunities",
      routesTo: "export_opportunities",
      prompt: "Which export opportunities fit my business?",
    },
    {
      id: "gs-plan",
      label: "Quarterly growth plan",
      routesTo: "action_plan",
      prompt: "Build me a quarterly growth plan.",
    },
  ],
  digital_transformation: [
    {
      id: "dt-website",
      label: "Should I launch a website?",
      routesTo: "decision_hire",
      prompt: "Should I launch a website this quarter?",
    },
    {
      id: "dt-payments",
      label: "Set up digital payments",
      routesTo: "operations",
      prompt: "How do I set up digital payments end-to-end?",
    },
    {
      id: "dt-roi",
      label: "What is the ROI?",
      routesTo: "finance",
      prompt: "What is the ROI of digitising my operations?",
    },
  ],
  finance: [
    {
      id: "fin-cost",
      label: "Cost of capital",
      routesTo: "finance",
      prompt: "What is the cheapest growth capital available to me?",
    },
    {
      id: "fin-loan",
      label: "Should I apply for a loan?",
      routesTo: "decision_loan",
      prompt: "Should I apply for a loan right now?",
    },
    {
      id: "fin-cash",
      label: "Cash flow plan",
      routesTo: "action_plan",
      prompt: "Build me a 90-day cash-flow plan.",
    },
  ],
  gst: [
    {
      id: "gst-cost",
      label: "Costs",
      routesTo: "finance",
      prompt: "What does GST registration and filing cost?",
    },
    {
      id: "gst-deadline",
      label: "Deadline",
      routesTo: "compliance",
      prompt: "What is the GST deadline for my business?",
    },
    {
      id: "gst-penalty",
      label: "Penalties",
      routesTo: "risk",
      prompt: "What are the GST penalties if I delay?",
    },
  ],
  government_schemes: [
    {
      id: "gs-eligibility",
      label: "Check Eligibility",
      routesTo: "government_schemes",
      prompt: "Check my eligibility for PMEGP, CGTMSE and MUDRA.",
    },
    {
      id: "gs-compare",
      label: "Compare with MUDRA",
      routesTo: "government_schemes",
      prompt: "Compare PMEGP with MUDRA for my business.",
    },
    {
      id: "gs-docs",
      label: "Required Documents",
      routesTo: "compliance",
      prompt: "What documents do I need to apply for these schemes?",
    },
  ],
  marketing: [
    {
      id: "mkt-channel",
      label: "Best channel for me",
      routesTo: "digital_transformation",
      prompt: "Which marketing channel performs best for my industry?",
    },
    {
      id: "mkt-budget",
      label: "Cheapest acquisition",
      routesTo: "growth_strategy",
      prompt: "What is the cheapest customer acquisition channel for me?",
    },
    {
      id: "mkt-content",
      label: "Content cadence",
      routesTo: "action_plan",
      prompt: "Build me a 30-day content cadence.",
    },
  ],
  operations: [
    {
      id: "ops-inventory",
      label: "Digitize inventory",
      routesTo: "digital_transformation",
      prompt: "How do I digitize inventory without breaking operations?",
    },
    {
      id: "ops-hire",
      label: "Should I Hire?",
      routesTo: "decision_hire",
      prompt: "Should I hire someone to fix my operations?",
    },
    {
      id: "ops-supplier",
      label: "Supplier risk",
      routesTo: "risk",
      prompt: "Where is my supplier risk concentrated?",
    },
  ],
  hiring: [
    {
      id: "h-yes",
      label: "Should I Hire?",
      routesTo: "decision_hire",
      prompt: "Should I hire someone now?",
    },
    {
      id: "h-role",
      label: "First role",
      routesTo: "operations",
      prompt: "What is the first role I should hire?",
    },
    {
      id: "h-cost",
      label: "Cost of hire",
      routesTo: "finance",
      prompt: "What does a first hire cost me?",
    },
  ],
  compliance: [
    {
      id: "c-list",
      label: "Full compliance checklist",
      routesTo: "compliance",
      prompt: "What is my full compliance checklist?",
    },
    {
      id: "c-tax",
      label: "Tax calendar",
      routesTo: "gst",
      prompt: "What is my tax calendar for the next 90 days?",
    },
    {
      id: "c-penalty",
      label: "Risk of ignoring",
      routesTo: "risk",
      prompt: "What happens if I keep ignoring my compliance gaps?",
    },
  ],
  risk: [
    {
      id: "r-top",
      label: "Top 3 risks",
      routesTo: "risk",
      prompt: "What are the top 3 risks I face this quarter?",
    },
    {
      id: "r-mitigate",
      label: "Mitigation plan",
      routesTo: "action_plan",
      prompt: "Build me a 30-day risk mitigation plan.",
    },
    {
      id: "r-insurance",
      label: "Insurance options",
      routesTo: "compliance",
      prompt: "Which insurance policies make sense for my business?",
    },
  ],
  scaling: [
    {
      id: "sc-expand",
      label: "Should I Expand?",
      routesTo: "decision_expand",
      prompt: "Should I expand to a new region or channel?",
    },
    {
      id: "sc-hire",
      label: "Hire for scale",
      routesTo: "decision_hire",
      prompt: "Should I hire to support scaling?",
    },
    {
      id: "sc-finance",
      label: "Capital for scale",
      routesTo: "decision_loan",
      prompt: "Should I take capital to fund scaling?",
    },
  ],
  decision_hire: [
    {
      id: "dh-role",
      label: "What role?",
      routesTo: "hiring",
      prompt: "If I hire, what role should I hire for?",
    },
    {
      id: "dh-cost",
      label: "Cost calculator",
      routesTo: "finance",
      prompt: "What does it cost me to make this hire?",
    },
    {
      id: "dh-alt",
      label: "Outsource alternative",
      routesTo: "operations",
      prompt: "Could I outsource this work instead?",
    },
  ],
  decision_expand: [
    {
      id: "de-market",
      label: "Best market to enter",
      routesTo: "export_opportunities",
      prompt: "Which export market should I enter first?",
    },
    {
      id: "de-cost",
      label: "Cost of expansion",
      routesTo: "finance",
      prompt: "What does expansion cost in my case?",
    },
    {
      id: "de-risk",
      label: "Expansion risk",
      routesTo: "risk",
      prompt: "What is the biggest risk if I expand?",
    },
  ],
  decision_loan: [
    {
      id: "dl-scheme",
      label: "Government loan instead?",
      routesTo: "government_schemes",
      prompt: "Is there a government loan better than a bank loan for me?",
    },
    {
      id: "dl-readiness",
      label: "Loan readiness score",
      routesTo: "finance",
      prompt: "What is my loan readiness score and how do I improve it?",
    },
    {
      id: "dl-cost",
      label: "Effective interest rate",
      routesTo: "finance",
      prompt: "What effective interest rate should I expect?",
    },
  ],
  action_plan: [
    {
      id: "ap-track",
      label: "How do I track progress?",
      routesTo: "explain_roadmap",
      prompt: "How do I track the progress of my action plan?",
    },
    {
      id: "ap-risk",
      label: "Risk if I skip a week",
      routesTo: "risk",
      prompt: "What happens if I skip a week of the action plan?",
    },
    {
      id: "ap-review",
      label: "Monthly review cadence",
      routesTo: "explain_recommendations",
      prompt: "Build a monthly review cadence for my action plan.",
    },
  ],
  fallback: [
    {
      id: "fb-improve",
      label: "How can I improve my business?",
      routesTo: "improve_business",
      prompt: "How can I improve my business?",
    },
    {
      id: "fb-score",
      label: "Why is my score low?",
      routesTo: "low_score",
      prompt: "Why is my business score low?",
    },
    {
      id: "fb-first",
      label: "What should I do first?",
      routesTo: "what_first",
      prompt: "What should I do first this week?",
    },
  ],
};
