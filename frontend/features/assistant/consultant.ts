"use client";

/**
 * Consultant orchestrator — Sprint H4 (Intelligence Layer).
 *
 * Single source of truth for "McKinsey-grade" answers. Reuses
 * every existing deterministic builder from `./builder.ts` —
 * no logic duplication — and stitches the result into the
 * six-section `ConsultantResponse` shape:
 *
 *   1. Executive Summary  (always open)
 *   2. Findings            (collapsible)
 *   3. Recommendations     (collapsible, card-grid)
 *   4. Estimated Impact    (collapsible)
 *   5. Action Plan         (collapsible, week-by-week)
 *   6. Next Questions      (collapsible, chip row)
 *
 * Plus an optional Decision Card slot used by the three
 * `decision_*` kinds.
 *
 * Pure. No I/O. Same bundle + same prompt + same memory
 * state => same ConsultantResponse. The orchestrator also
 * composes a plain-text fallback `body` for legacy callers
 * (e.g. the export-conversation feature).
 */

import type {
  AIDecisionResponse,
  RuleCategoryBlock,
  RulesResponse,
} from "@/types/dashboard";
import type {
  RecommendationsResponse,
  RecommendationItem,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import { formatScoreGain, formatRoi } from "./format-numbers";
import {
  buildBusinessSnapshot,
  composeGreeting,
  type BusinessSnapshot,
} from "./context-snapshot";
import {
  resolveSources as resolveSourcesP0,
  sourceAttribution,
  rescueClassify,
  detectContinuity,
  buildContinuityBanner,
  rescueBody,
  ensureDecisionPayload,
  matchIndustry,
  extractGrowthTarget,
  formatInr,
  extractUserConcern,
  detectAudience,
  detectProductHelp,
  productHelpBody,
  industryPlaybookBullets,
  industryGreetingLine,
  audienceMarketingBullets,
  audienceSummary,
  userConcernLeadBullet,
  normalizeActionWeeks,
  growthTargetBody,
  growthTargetWeeks,
  GROWTH_LEVERS,
  type SourceContext,
} from "./assistant-p0";
import type { AssistantBundle } from "./builder";
import type {
  ActionWeek,
  ConsultantBullet,
  ConsultantResponse,
  ConsultantSection,
  DecisionCardPayload,
  QueryKind,
} from "./types";

// Silence "unused" warnings for the helper imports — they're used
// by downstream consumers that re-import from this module.
void formatScoreGain;
void formatRoi;

// --------------------------------------------------------------------------- //
// Public entry                                                             //
// --------------------------------------------------------------------------- //

export interface ConsultantOptions {
  bundle: AssistantBundle;
  prompt: string;
  kind: QueryKind;
  /** Pass-through topic label if memory knows it. */
  topic?: string;
  /** Memory recall for "earlier you asked ..." continuity lines. */
  recentTopics?: string[];
}

export function buildConsultantResponse(
  options: ConsultantOptions,
): ConsultantResponse {
  const { bundle, prompt } = options;
  let { kind } = options;
  const snapshot = buildBusinessSnapshot(bundle);

  // ---- P0.2 fallback rescue -------------------------------------------- //
  // If the keyword classifier returned `fallback`, run a second-pass
  // semantic scan over the prompt. If the rescue classifier finds a
  // confident business intent, route there. Otherwise compose a
  // profile-aware rescue response (no generic overview).
  let usedRescue = false;
  let rescueClarifying: string | null = null;
  let rescueSuggestedTopics: string[] | null = null;
  if (kind === "fallback") {
    const rescued = rescueClassify(prompt);
    if (rescued) {
      kind = rescued;
    } else {
      usedRescue = true;
      const ctx = buildSourceContext(bundle, snapshot);
      const rescue = rescueBody(prompt, ctx);
      rescueClarifying = rescue.clarifyingQuestion;
      rescueSuggestedTopics = rescue.suggestedTopics;
    }
  }

  // ---- P1.6 product-help priority routing ----------------------------- //
  // The classifier's keyword bucket "export" matches both business
  // export and "how do I export this conversation?". Product help
  // wins when the prompt is clearly about using UrsBiz features.
  // We re-route here, before any topic intent runs, so a question
  // like "How do I export this conversation?" never reaches the
  // export_opportunities composer.
  const productHelpResult = detectProductHelp(prompt);
  if (productHelpResult.isProductHelp) {
    kind = "product_help";
  }

  // ---- P1.3 growth-target routing ------------------------------------- //
  // Detect numeric revenue-target phrases (₹1.5 Cr → ₹3 Cr) and
  // route to a dedicated composer. Without this, the prompt lands
  // in `fallback` and the rescue classifier might match on "growth"
  // but never produce the gap / lever / phased action plan.
  const growthTarget = extractGrowthTarget(prompt);
  if (
    growthTarget.present &&
    (growthTarget.currentInr !== null || growthTarget.targetInr !== null) &&
    (kind === "fallback" ||
      kind === "improve_business" ||
      kind === "growth_strategy" ||
      kind === "what_first")
  ) {
    // Only redirect if the prompt is explicitly target-shaped
    // (mentions "from X to Y" or "reach/target X" or "grow to X").
    const goalShaped =
      /(from\s+.+?\s+to\s+)/i.test(prompt) ||
      /(reach|target|grow to|grow from|hit|achieve)\s+.{0,40}(crore|cr\b|lakh|L\b|₹|rs\.?)/i.test(prompt);
    if (goalShaped) kind = "growth_target";
  }

  // ---- P1.4 user-stated concern priority ------------------------------ //
  // When the user explicitly states a worry ("my biggest worry is
  // supplier dependency"), route to risk so the concern leads the
  // response — even when the classifier originally picked something
  // else (e.g. "fallback" from the rescue pass). User-stated
  // concerns must never be buried beneath generic rule firings.
  const userConcern = extractUserConcern(prompt);
  if (
    userConcern.present &&
    (kind === "fallback" ||
      kind === "improve_business" ||
      kind === "general_overview")
  ) {
    kind = "risk";
  }

  // ---- P0.3 memory continuity ----------------------------------------- //
  // Detect "earlier you talked about X" continuity phrases. If the user
  // is referencing a prior topic, prepend a continuity banner to the
  // Executive Summary body so the conversation flows naturally.
  const continuity = detectContinuity(prompt);
  const continuityBanner =
    continuity.isFollowup && continuity.earlierTopic
      ? buildContinuityBanner(continuity.earlierTopic, options.recentTopics ?? [])
      : null;

  const route = ROUTES[kind] ?? ROUTES.fallback;
  const sections: ConsultantSection[] = [];

  // 1. Executive Summary — always first, always open.
  const summarySection = route.summary(bundle, snapshot, prompt);
  if (continuityBanner) {
    summarySection.body = `${continuityBanner} ${summarySection.body ?? ""}`.trim();
  }
  sections.push(summarySection);

  // 1b. If we ran the rescue composer (no confident intent), append
  // the clarifying-question block as a separate findings-style section
  // so the user sees a structured response instead of a generic dump.
  if (usedRescue && rescueClarifying && rescueSuggestedTopics) {
    sections.push(
      section("findings", "What I understood", {
        caption: "Reading the prompt + your profile together.",
        bullets: rescueSuggestedTopics.map((t, i) => ({
          id: `clarify-${i}`,
          title: t,
          subtitle: "Tap to send this question next.",
          tone: "info",
        })),
      }),
    );
    sections.push(
      section("recommendations", "A clarifying question", {
        bullets: [
          {
            id: "clarify-q",
            title: rescueClarifying,
            subtitle: "Your answer narrows down which specialist answer to surface.",
            tone: "primary",
          },
        ],
      }),
    );
    sections.push(
      section("next_questions", "What you can ask next", {
        bullets: rescueSuggestedTopics.map((t, i) => ({
          id: `next-${i}`,
          title: t,
          tone: "info",
        })),
      }),
    );
  } else {
    // 2-6. Topic-specific sections.
    route.compose(bundle, snapshot, sections, prompt);
  }

  // ---- P0.1 decision-card guard --------------------------------------- //
  // If the kind is decision_*, walk the sections and guarantee a
  // non-empty decision payload.
  if (kind === "decision_hire" || kind === "decision_expand" || kind === "decision_loan") {
    const decisionSection = sections.find((s) => s.key === "decision");
    if (decisionSection) {
      decisionSection.decision = ensureDecisionPayload(
        kind,
        decisionSection.decision,
        {
          healthScore: snapshot.healthScore,
          dnaMatch: snapshot.dnaMatch,
          estimatedRoi: snapshot.estimatedRoi,
          revenueBandLabel: snapshot.revenueBand?.label ?? "—",
        },
      );
    }
  }

  // Re-order: keep summary → findings → recs → impact → plan → questions → decision.
  sections.sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key),
  );

  const sources = resolveSources(route.sources, bundle, snapshot);
  const body = renderPlainText(sections, snapshot);
  const greeting = composeGreeting(
    snapshot,
    new Date().getHours(),
  );

  return {
    greeting,
    topic: options.topic ?? route.topic,
    sources,
    sections,
    body,
    kind,
  };
}

const SECTION_ORDER: ConsultantSection["key"][] = [
  "summary",
  "findings",
  "recommendations",
  "impact",
  "action_plan",
  "next_questions",
  "decision",
];

function resolveSources(
  source: RouteHandlers["sources"],
  bundle: AssistantBundle,
  snapshot: BusinessSnapshot,
): ConsultantResponse["sources"] {
  const ctx = buildSourceContext(bundle, snapshot);
  if (typeof source === "function") {
    // Some source-functions are bundle-aware; let them produce
    // the topic list first, then we substitute topic-specific
    // attribution lines for each.
    const resolved = source(bundle, snapshot);
    return resolved.map((s) => ({
      topic: s.topic,
      detail: sourceAttribution(s.topic, ctx),
    }));
  }
  if (Array.isArray(source)) {
    return source.map((s) => ({
      topic: s.topic,
      detail: sourceAttribution(s.topic, ctx),
    }));
  }
  return [];
}

function buildSourceContext(
  bundle: AssistantBundle,
  snapshot: BusinessSnapshot,
): SourceContext {
  const recCount = bundle.recommendations.recommendations?.length ?? 0;
  const criticalCount = bundle.recommendations.recommendations?.filter(
    (r) => r.priority === "Critical",
  ).length ?? 0;
  const highCount = bundle.recommendations.recommendations?.filter(
    (r) => r.priority === "High",
  ).length ?? 0;
  const roadmapItems = snapshot.roadmapTotalItems;
  const projectedScore =
    bundle.twin.timeline?.twelve_month?.projected_overall_score ?? null;
  const insightCount =
    bundle.decision?.decision?.insights?.length ?? 0;
  const ruleFirings =
    bundle.rules.summary?.total_firings ?? 0;
  const activeRulesCategories =
    bundle.rules.summary?.categories_with_firings ?? 0;
  return {
    legalName: snapshot.legalName || null,
    industry: snapshot.industry || null,
    revenueBandLabel: snapshot.revenueBand?.label ?? "—",
    healthScore: snapshot.healthScore,
    dnaArchetype: snapshot.dnaArchetype || null,
    dnaMatch: snapshot.dnaMatch,
    recCount,
    criticalCount,
    highCount,
    roadmapItems,
    projectedScore,
    insightCount,
    ruleFirings,
    activeRulesCategories,
  };
}

// --------------------------------------------------------------------------- //
// Shared shapes                                                            //
// --------------------------------------------------------------------------- //

interface RouteHandlers {
  topic: string;
  summary: (
    bundle: AssistantBundle,
    snapshot: BusinessSnapshot,
    prompt: string,
  ) => ConsultantSection;
  compose: (
    bundle: AssistantBundle,
    snapshot: BusinessSnapshot,
    sections: ConsultantSection[],
    prompt: string,
  ) => void;
  sources: ConsultantResponse["sources"] | ((
    bundle: AssistantBundle,
    snapshot: BusinessSnapshot,
  ) => ConsultantResponse["sources"]);
}

// --------------------------------------------------------------------------- //
// Topic-specific routes                                                    //
// --------------------------------------------------------------------------- //

const ROUTES: Record<QueryKind, RouteHandlers> = {
  improve_business: {
    topic: "Improve my business",
    summary: improveSummary,
    compose: composeImprove,
    sources: improveSources,
  },
  low_score: {
    topic: "Why is my score low",
    summary: lowScoreSummary,
    compose: composeLowScore,
    sources: lowScoreSources,
  },
  growth_strategy: {
    topic: "Business growth",
    summary: growthSummary,
    compose: composeGrowth,
    sources: growthSources,
  },
  digital_transformation: {
    topic: "Digital transformation",
    summary: digitalSummary,
    compose: composeDigital,
    sources: digitalSources,
  },
  finance: {
    topic: "Finance",
    summary: financeSummary,
    compose: composeFinance,
    sources: financeSources,
  },
  gst: {
    topic: "GST",
    summary: gstSummary,
    compose: composeGst,
    sources: commonSources(["Twin", "Compliance"]),
  },
  government_schemes: {
    topic: "Government schemes",
    summary: schemesSummary,
    compose: composeSchemes,
    sources: commonSources(["Twin", "Government Schemes"]),
  },
  marketing: {
    topic: "Marketing",
    summary: marketingSummary,
    compose: composeMarketing,
    sources: commonSources(["Twin", "Marketing"]),
  },
  operations: {
    topic: "Operations",
    summary: operationsSummary,
    compose: composeOperations,
    sources: commonSources(["Twin", "Roadmap"]),
  },
  hiring: {
    topic: "Hiring",
    summary: hiringSummary,
    compose: composeHiring,
    sources: commonSources(["Twin", "Recommendations"]),
  },
  compliance: {
    topic: "Compliance",
    summary: complianceSummary,
    compose: composeCompliance,
    sources: commonSources(["Twin", "Rules"]),
  },
  risk: {
    topic: "Risk",
    summary: riskSummary,
    compose: composeRisk,
    sources: commonSources(["Twin", "Rules"]),
  },
  scaling: {
    topic: "Scaling",
    summary: scalingSummary,
    compose: composeScaling,
    sources: commonSources(["Twin", "Recommendations"]),
  },
  what_first: {
    topic: "What should I do first",
    summary: whatFirstSummary,
    compose: composeWhatFirst,
    sources: commonSources(["Twin", "Roadmap"]),
  },
  export_opportunities: {
    topic: "Export opportunities",
    summary: exportSummary,
    compose: composeExport,
    sources: commonSources(["Twin", "Export"]),
  },
  business_dna: {
    topic: "Business DNA",
    summary: dnaSummary,
    compose: composeDna,
    sources: commonSources(["Twin", "Business DNA"]),
  },
  explain_roadmap: {
    topic: "Roadmap",
    summary: roadmapSummary,
    compose: composeRoadmap,
    sources: commonSources(["Twin", "Roadmap"]),
  },
  explain_recommendations: {
    topic: "Recommendations",
    summary: recommendationsSummary,
    compose: composeRecommendations,
    sources: commonSources(["Twin", "Recommendations"]),
  },
  explain_insights: {
    topic: "Insights",
    summary: insightsSummary,
    compose: composeInsights,
    sources: commonSources(["Twin", "Insights"]),
  },
  explain_rules: {
    topic: "Rules",
    summary: rulesSummaryFn,
    compose: composeRulesFn,
    sources: commonSources(["Twin", "Rules"]),
  },
  general_overview: {
    topic: "Overview",
    summary: overviewSummary,
    compose: composeOverview,
    sources: overviewSources,
  },
  decision_hire: {
    topic: "Should I Hire?",
    summary: decisionHireSummary,
    compose: composeDecisionHire,
    sources: commonSources(["Twin", "Recommendations"]),
  },
  decision_expand: {
    topic: "Should I Expand?",
    summary: decisionExpandSummary,
    compose: composeDecisionExpand,
    sources: commonSources(["Twin", "Roadmap"]),
  },
  decision_loan: {
    topic: "Should I apply for a Loan?",
    summary: decisionLoanSummary,
    compose: composeDecisionLoan,
    sources: commonSources(["Twin", "Recommendations"]),
  },
  action_plan: {
    topic: "Action plan",
    summary: actionPlanSummary,
    compose: composeActionPlan,
    sources: commonSources(["Twin", "Roadmap"]),
  },
  fallback: {
    topic: "General",
    summary: fallbackSummary,
    compose: composeFallback,
    sources: overviewSources,
  },
  growth_target: {
    topic: "Growth target",
    summary: growthTargetSummary,
    compose: composeGrowthTarget,
    sources: commonSources(["Twin", "Recommendations", "Roadmap"]),
  },
  product_help: {
    topic: "Product help",
    summary: productHelpSummary,
    compose: composeProductHelp,
    sources: commonSources(["Twin"]),
  },
};

// --------------------------------------------------------------------------- //
// Shared section builders                                                  //
// --------------------------------------------------------------------------- //

function section(
  key: ConsultantSection["key"],
  title: string,
  partial: Partial<ConsultantSection> = {},
): ConsultantSection {
  return { key, title, ...partial };
}

function findings(items: ConsultantBullet[], title = "What I found", caption?: string): ConsultantSection {
  return section("findings", title, { bullets: items, caption });
}

function recommendations(
  items: ConsultantBullet[],
  title = "What you should do",
  caption?: string,
): ConsultantSection {
  return section("recommendations", title, { bullets: items, caption });
}

function impactLines(lines: string[], title = "Estimated impact"): ConsultantSection {
  return section("impact", title, { lines });
}

function nextQuestionsLabels(
  list: ReadonlyArray<{ id: string; label: string }> | undefined,
): ConsultantSection {
  return section(
    "next_questions",
    "Next questions to ask",
    {
      bullets: (list ?? []).map((q) => ({
        id: q.id,
        title: q.label,
      })),
      caption:
        "Tap any of these to keep the conversation moving — they route through the consultant automatically.",
    },
  );
}

function impactFromSnapshot(snapshot: BusinessSnapshot): ConsultantSection {
  return impactLines(
    [
      `+${snapshot.estimatedScoreGain} pts expected if you execute the priority list end-to-end.`,
      `~${snapshot.estimatedRoi}% modelled ROI across the recommendations.`,
      `12-month projected score: ${snapshot.projectedScore}/100 vs current ${snapshot.healthScore}/100.`,
    ],
    "Estimated impact",
  );
}

// --------------------------------------------------------------------------- //
// Common helpers / inline cards                                            //
// --------------------------------------------------------------------------- //

function actionWeeksFromRecommendation(rec: RecommendationItem): ActionWeek[] {
  // Deterministic Week 1..4 ladder per recommendation category —
  // a senior consultant's first-pass checklist.
  const base = rec.title;
  const priority = rec.priority;
  const cat = rec.category;
  // Heuristics: choose the appropriate scaffold by category.
  const digital =
    cat === "digital_transformation_actions" ||
    /website|web|seo|digital|online|portfolio|app|brand|google|social/i.test(base);
  const exportCat = cat === "export_readiness_actions" || /export|iec|trade|ship|overseas/i.test(base);
  const financeCat = cat === "high_priority" || /loan|gst|tax|funding|scheme|invoice|cash|account/i.test(base);
  const complianceCat = cat === "compliance_actions" || /compliance|registration|licence|permit|legal/i.test(base);

  const title = base;
  // The scaffolders below emit only the legacy `week` + `steps`
  // fields. We type them as LegacyWeek so the compiler does not
  // insist on the new `weekNumber/weekLabel/objective/actions`
  // quartet (P1.2) being populated inline. `normalizeActionWeeks`
  // (last line) fills in those fields in one pass.
  type LegacyWeek = { week: string; steps: string[] };
  let raw: LegacyWeek[];
  if (digital) {
    raw = [
      {
        week: "Week 1 — Discover",
        steps: [
          `Audit current digital footprint — list ${title.toLowerCase()} gaps and baseline channel metrics.`,
          "Confirm target audience and brand positioning (one-page brief).",
          "Lock down a single success metric (e.g. qualified leads / month).",
        ],
      },
      {
        week: "Week 2 — Build",
        steps: [
          "Stand up the missing asset (e.g. microsite / landing page / Google Business profile).",
          "Wire analytics (GA4 / Plausible) and one conversion event.",
          "Draft a 4-week content calendar aligned to the positioning brief.",
        ],
      },
      {
        week: "Week 3 — Activate",
        steps: [
          "Launch the campaign (paid + organic distribution).",
          "Brief the team on weekly review cadence.",
          `Prioritise: hit the planned milestone for ${rec.estimated_timeline || "this phase"}.`,
        ],
      },
      {
        week: "Week 4 — Optimise",
        steps: [
          "Weekly review: verify the success metric moved by ≥ 10%.",
          "Double down on the top channel; cut the bottom one.",
          "Re-rank recommendations for the following month.",
        ],
      },
    ];
  } else if (exportCat) {
    raw = [
      {
        week: "Week 1 — Pre-qualification",
        steps: [
          "Obtain or renew the IEC (Import Export Code) — prerequisite for any cross-border move.",
          "List the three most likely destination markets based on product fit.",
          "Engage a freight partner for an indicative shipping quote.",
        ],
      },
      {
        week: "Week 2 — Compliance",
        steps: [
          "Reconfirm GST + product-specific HS codes (4–8 digits).",
          "Register on the relevant export portal (e.g. ICEGATE / Amazon Global).",
          "Compile the standard document set (IEC, GST, PAN, bank certificate, MOA/AOA).",
        ],
      },
      {
        week: "Week 3 — First shipment",
        steps: [
          "Ship the first test consignment; verify end-to-end duty flow.",
          "Set payment terms (LC / advance / open credit) and bank reconciliation cadence.",
          "Stand up a 1-page finance dashboard for export revenue.",
        ],
      },
      {
        week: "Week 4 — Scale",
        steps: [
          "Pilot review — what % of the first batch converted in 30 days?",
          `Decide scale decision: ${priority === "Critical" ? "expand immediately" : "iterate on the pilot"}.`,
          "Refresh the destination shortlist using the new data.",
        ],
      },
    ];
  } else if (complianceCat || financeCat) {
    raw = [
      {
        week: "Week 1 — File readiness",
        steps: [
          "Inventory documents: PAN, GST, bank statements, last 12m ITR, registration proofs.",
          `Confirm due date / deadline for ${title}.`,
          "Open tracker — list every task in priority order.",
        ],
      },
      {
        week: "Week 2 — File paperwork",
        steps: [
          "Submit the application / filing on Day 8 (gives buffer if documents come back).",
          "Pay any fees / stamp duty online; archive the receipt reference.",
          "Notify bank and CA via a single email with the receipt.",
        ],
      },
      {
        week: "Week 3 — Approval / acknowledgement",
        steps: [
          "Track acknowledgement from the relevant authority.",
          "Upload certificates back into the Business Profile.",
          `Rule-engine will now re-grade this recommendation as resolved.`,
        ],
      },
      {
        week: "Week 4 — Risk review",
        steps: [
          `Confirm there is no ${title.toLowerCase()} renewal due in 90 days.`,
          "Lock in a recurring 30-day reminder for compliance re-check.",
          "Re-score: the Business Health meter should rise by next refresh.",
        ],
      },
    ];
  } else {
    // Generic improvement flow.
    raw = [
      {
        week: "Week 1 — Set up",
        steps: [
          `Define success: what does "done" look like for ${title}?`,
          "Identify the smallest experiment you can ship this week.",
          "Set up a tracking dashboard (1 metric, 1 cycle).",
        ],
      },
      {
        week: "Week 2 — Kickoff",
        steps: [
          "Run the experiment; capture one data point per day.",
          `Budget: keep spend below 1% of monthly revenue.`,
          "Daily 5-minute review cadence with the team.",
        ],
      },
      {
        week: "Week 3 — Iterate",
        steps: [
          "Read the metrics; double down on what moved.",
          "Cut anything that didn't shift the needle by 10%.",
          "Compress the action's timeline by 1 week if ahead of plan.",
        ],
      },
      {
        week: "Week 4 — Handover",
        steps: [
          "Document what worked + what didn't.",
          "Promote the best practice into the team playbook.",
          "Schedule the next experiment; refresh the priority list.",
        ],
      },
    ];
  }
  // P1.2 — synchronise weekNumber / weekLabel / objective / actions
  // on every emitted week. Replaces any undefined or "undefined"
  // label with the canonical `Week N — Phase` format.
  return normalizeActionWeeks(raw);
}

function asBullet(rec: RecommendationItem): ConsultantBullet {
  return {
    id: rec.id,
    title: rec.title,
    subtitle: rec.description,
    tone:
      rec.priority === "Critical"
        ? "danger"
        : rec.priority === "High"
          ? "warn"
          : rec.priority === "Medium"
            ? "info"
            : "violet",
    meta: `${humanizeCategory(rec.category)} · ${rec.estimated_timeline}`,
    impact: `+${Math.round(rec.estimated_score_gain || 0)} pts · ${Math.round(rec.estimated_roi || 0)}% ROI`,
    difficulty: rec.difficulty,
    time: rec.estimated_timeline,
    confidence: Math.round(rec.confidence || 60),
    riskIfIgnored: `Score will stay flat for ${rec.estimated_timeline || "the next quarter"}.`,
  };
}

/**
 * Lightweight mapper used for items surfaced from the BusinessSnapshot
 * (which carries a stripped schema). Looks up the full
 * RecommendationItem via id so we get the same shape as `asBullet`.
 */
function asBulletFromId(
  id: string,
  recs: RecommendationItem[],
): ConsultantBullet | undefined {
  const rec = recs.find((r) => r.id === id);
  return rec ? asBullet(rec) : undefined;
}

/**
 * Maps a list of snapshot summaries to ConsultantBullets using
 * the underlying recommendations payload. Drops ids that can't
 * be resolved so the UI never sees a partial object.
 */
function bulletsForSnapshot(
  s: BusinessSnapshot,
  recs: RecommendationItem[],
): ConsultantBullet[] {
  const out: ConsultantBullet[] = [];
  for (const sr of s.topRecommendations) {
    const bullet = asBulletFromId(sr.id, recs);
    if (bullet) out.push(bullet);
  }
  return out;
}

function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --------------------------------------------------------------------------- //
// Composed route implementations                                            //
// --------------------------------------------------------------------------- //

function improveSummary(b: AssistantBundle, s: BusinessSnapshot, prompt: string): ConsultantSection {
  const targetScore = Math.max(s.healthScore + s.estimatedScoreGain, s.healthScore);
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  return section(
    "summary",
    "Executive Summary",
    {
      caption: `Profile: ${s.legalName} · ${s.industry} · ${s.revenueBand.label}`,
      body: [
        `You asked me to "improve your business." Here is the consultant read in one paragraph.`,
        `Your current business score is **${s.healthScore}/100** (${s.healthBand} band). Closing the ${s.criticalRecommendations} critical + ${s.highRecommendations} high-priority recommendations projects you to **~${targetScore}/100** within ${b.roadmap.summary.total_estimated_duration}.`,
        `Total estimated score gain: +${s.estimatedScoreGain} pts. Total expected ROI: ${s.estimatedRoi}%.`,
        industryGreetingLine(adapt, "improve", s.legalName),
      ].join(" "),
    },
  );
}

function composeImprove(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const top = bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 5);
  sections.push(
    findings(
      [
        {
          id: "im-score",
          title: `Current business score is ${s.healthScore}/100`,
          subtitle: `${s.healthBand} band — three critical paths to lift it`,
          tone: s.healthScore >= 60 ? "success" : "warn",
        },
        {
          id: "im-rules",
          title: `${s.rulesFiring} active rule firings`,
          subtitle: "Each one is a direct opportunity waiting to be actioned.",
          tone: "info",
        },
        {
          id: "im-dna",
          title: `${s.dnaArchetype} DNA at ${s.dnaMatch}%`,
          subtitle:
            "Your archetype narrows the effective action list — we filtered it accordingly.",
          tone: "violet",
        },
      ],
      "Findings",
    ),
  );
  if (top.length > 0) {
    sections.push(recommendations(top, "Top 5 priority actions"));
  }
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, top));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.improve_business));
}

function lowScoreSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const lowest = [...s.topRecommendations]
    .sort((a, b) => b.estimatedScoreGain - a.estimatedScoreGain)
    .slice(0, 1)
    .pop();
  return section(
    "summary",
    "Executive Summary",
    {
      body: [
        `Your score is **${s.healthScore}/100** (${s.healthBand}). The score reflects the gaps the rule engine surfaced after the last analysis — ${s.rulesFiring} of them are still firing.`,
        lowest
          ? `The single biggest lift comes from "${lowest.title}" — currently +${lowest.estimatedScoreGain} pts and ~${lowest.estimatedRoi}% ROI.`
          : `The single biggest lift comes from your top-ranked recommendation — see the Findings card for the ranked list.`,
      ].join(" "),
    },
  );
}

function composeLowScore(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const lowest = b.twin.scores.scores
    .filter((sc) => (sc.score ?? 100) < 40)
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
    .slice(0, 5)
    .map((sc) => ({
      id: `lowp-${sc.key}`,
      title: `${sc.title}: ${sc.score}/100`,
      subtitle: sc.explanation,
      tone: "danger" as const,
    }));
  if (lowest.length > 0) {
    sections.push(findings(lowest, "Your weakest pillars"));
  }
  const top = bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 5);
  sections.push(recommendations(top, "Recommended moves to lift the score"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, top));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.low_score));
}

function growthSummary(b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  return section("summary", "Executive Summary", {
    body: [
      industryGreetingLine(adapt, "growth", s.legalName),
      `We're treating "growth" as a portfolio of three workstreams: (1) revenue expansion via marketing + sales, (2) capability uplift via digital, and (3) capital-readiness via schemes.`,
      `Projected end-state after the priority list completes in ${b.roadmap.summary.total_estimated_duration}: business score ${s.projectedScore}/100 (+${s.estimatedScoreGain} pts) at ~${s.estimatedRoi}% modelled ROI.`,
      `Industry-anchored move for ${adapt.label}: ${adapt.playbook[0] ?? adapt.vocabulary.certifications[0]}.`,
    ].join(" "),
  });
}

function composeGrowth(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  sections.push(
    findings(
      [
        {
          id: "g-mkt",
          title: "Marketing maturity",
          subtitle: s.usesDigitalMarketing ? "Active — leverage it" : "Quiet — opportunity to switch on",
          tone: s.usesDigitalMarketing ? "success" : "warn",
        },
        {
          id: "g-product",
          title: `Product surface: ${s.productsCount} SKUs`,
          subtitle: "Determines content cadence and SEO ceiling.",
          tone: "info",
        },
        {
          id: "g-recs",
          title: `${s.recommendationCount} active recommendations`,
          subtitle: `${s.criticalRecommendations} critical, ${s.highRecommendations} high priority.`,
          tone: "violet",
        },
        {
          id: "g-industry",
          title: `Industry anchor: ${adapt.label}`,
          subtitle: `Discovery channel: ${adapt.vocabulary.channels[0]}. Certification: ${adapt.vocabulary.certifications[0]}.`,
          tone: "violet",
        },
      ],
      "Where growth starts",
    ),
  );
  const top = bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 4);
  sections.push(recommendations(top, "Growth moves for this quarter"));
  // P1.1 industry-adaptive playbook — append 2 industry-specific bullets
  // to the recommendations section so the advice carries industry
  // vocabulary instead of generic MSME templates.
  const existing = sections.find((s) => s.key === "recommendations");
  if (existing) {
    const industryBullet: ConsultantBullet[] = industryPlaybookBullets(adapt, "growth").map(
      (line, i) => ({
        id: `g-industry-${i}`,
        title: line,
        tone: "info",
        meta: adapt.label,
      }),
    );
    existing.bullets = [...(existing.bullets ?? []), ...industryBullet];
  }
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, top));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.growth_strategy));
}

function digitalSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const present =
    [s.hasWebsite, s.hasEcommerce, s.usesDigitalMarketing].filter(Boolean).length;
  return section("summary", "Executive Summary", {
    body: [
      `Digital transformation read for **${s.legalName}**. Your current digital footprint covers **${present} of 3 core channels** (website / e-commerce / digital marketing).`,
      `Each missing channel has a clean 4-week ramp path — see the Action Plan card.`,
    ].join(" "),
  });
}

function composeDigital(_b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "d-web",
          title: `Website ${s.hasWebsite ? "live" : "missing"}`,
          tone: s.hasWebsite ? "success" : "warn",
        },
        {
          id: "d-ecom",
          title: `E-commerce ${s.hasEcommerce ? "live" : "missing"}`,
          tone: s.hasEcommerce ? "success" : "warn",
        },
        {
          id: "d-mkt",
          title: `Digital marketing ${s.usesDigitalMarketing ? "active" : "off"}`,
          tone: s.usesDigitalMarketing ? "success" : "warn",
        },
      ],
      "Channel audit",
    ),
  );
  const ideas: ConsultantBullet[] = [];
  if (!s.hasWebsite)
    ideas.push(asBulletFor(
      "Launch a corporate website",
      "4-week ramp. Wire analytics on Day 1 and set one conversion event.",
      "warn",
      "+6 pts",
      "Easy",
      "3–4 weeks",
    ));
  if (!s.hasEcommerce)
    ideas.push(asBulletFor(
      "Stand up e-commerce / catalogue",
      "Pick the platform aligned with your industry band; integrate payments on Day 7.",
      "info",
      "+5 pts",
      "Moderate",
      "6–8 weeks",
    ));
  if (!s.usesDigitalMarketing)
    ideas.push(asBulletFor(
      "Activate digital marketing",
      "Start with paid social on a single channel; commit a 30-day review cadence.",
      "violet",
      "+4 pts",
      "Easy",
      "2 weeks",
    ));
  if (ideas.length === 0) {
    ideas.push(
      asBulletFor(
        "Optimise the funnel you already have",
        "Add retargeting; A/B test the hero copy; reduce checkout friction.",
        "primary",
        "+3 pts",
        "Easy",
        "1 week",
      ),
    );
  }
  sections.push(recommendations(ideas, "Digital transformation actions"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(_b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.digital_transformation));
}

function financeSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Finance view for **${s.legalName}** (${s.revenueBand.label} business, ~${s.employeeCount} employees).`,
      `Working capital levers ranked below. We sequenced them so the cheapest money is unlocked first.`,
    ].join(" "),
  });
}

function composeFinance(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "f-rev",
          title: `Annual revenue: ${formatRoi(s.annualRevenue)}`,
          subtitle: s.revenueBand.label,
          tone: "info",
        },
        {
          id: "f-up",
          title: "Capital ladder",
          subtitle: "Government schemes → credit guarantee → bank loan → equity",
          tone: "violet",
        },
        {
          id: "f-cred",
          title: "Working-capital posture",
          subtitle:
            s.healthScore >= 60
              ? "Room to expand on credit."
              : "Tighten receivables first, raise capital second.",
          tone: s.healthScore >= 60 ? "success" : "warn",
        },
      ],
      "Capital position",
    ),
  );
  const recs: ConsultantBullet[] = [
    asBulletFor(
      "PMEGP application (subsidy 15-35%)",
      "First in the capital ladder — risk-free if the project plan is acceptable.",
      "success",
      "Up to 35% subsidy",
      "Moderate",
      "60–90 days",
    ),
    asBulletFor(
      "CGTMSE collateral-free loan",
      "Best for working-capital needs of up to ₹5Cr without pledging assets.",
      "info",
      "Up to ₹5 Cr",
      "Moderate",
      "45–60 days",
    ),
    asBulletFor(
      "MUDRA (Shishu / Kishore / Tarun)",
      "Quick unsecured loan up to ₹10L, ideal for inventory + capex small spend.",
      "violet",
      "Up to ₹10 L",
      "Easy",
      "30 days",
    ),
  ];
  sections.push(recommendations(recs, "Capital-ladder options for you"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.finance));
}

function gstSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `**GST** for ${s.legalName}. Below is the consultant walkthrough — eligibility, deadlines, costs, penalties, and a 4-week ramp for registration if you don't have it yet.`,
    ].join(" "),
  });
}

function composeGst(_b: AssistantBundle, _s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "gst-reg",
          title: "Registration threshold (₹20L / ₹40L goods/services)",
          subtitle: "Mandatory if you cross the threshold or sell inter-state.",
          tone: "info",
        },
        {
          id: "gst-deadline",
          title: "Returns: GSTR-1 / 3B monthly or quarterly",
          subtitle: "Pick the quarterly scheme if turnover < ₹5Cr.",
          tone: "info",
        },
        {
          id: "gst-pen",
          title: "Late-filing penalty",
          subtitle: "₹50/day CGST+SGST (₹25 each), capped at 0.25% of turnover.",
          tone: "danger",
        },
      ],
      "GST mechanics for an MSME",
    ),
  );
  const recs: ConsultantBullet[] = [
    asBulletFor(
      "File the GST REG-01 application",
      "Required pre-conditions: PAN, Aadhaar of the proprietor, business address proof.",
      "success",
      "One-time",
      "Moderate",
      "7–15 days",
    ),
    asBulletFor(
      "Opt into the QRMP scheme (if turnover < ₹5Cr)",
      "Quarterly return + monthly payment. Saves time + CA cost.",
      "info",
      "Lower compliance load",
      "Easy",
      "1 day to opt in",
    ),
    asBulletFor(
      "Automate invoice → GSTR-1 → GSTR-3B with a CA + software stack",
      "Compliance-grade automation + a CA subscription for ₹1–2k/month pays for itself.",
      "violet",
      "Saves 6 hours/month",
      "Easy",
      "2 weeks",
    ),
  ];
  sections.push(recommendations(recs, "What I recommend"));
  sections.push(
    impactLines(
      [
        "Avoid ₹50/day × N days × every return you would have missed.",
        "Eligible to claim input tax credit (ITC) on every business purchase.",
        "Opens the door for export-with-IGST refund workflows.",
      ],
      "Estimated impact",
    ),
  );
  sections.push(actionPlanSection(_b, _s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.gst));
}

function schemesSummary(_b: AssistantBundle, _s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Government scheme matcher for **${_s.legalName}** (${_s.revenueBand.label}).`,
      `PMEGP, CGTMSE and MUDRA are the three schemes every MSME should hold an opinion on. Below is the eligibility read + the next step for each.`,
    ].join(" "),
  });
}

function composeSchemes(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const schemes = b.twin.opportunity_matrix.funding_opportunities;
  sections.push(
    findings(
      [
        {
          id: "sc-match",
          title: `Scheme match across ${schemes.length || "3"} tracked schemes`,
          subtitle: "Computed from your profile depth + revenue band + industry.",
          tone: "info",
        },
        {
          id: "sc-doc",
          title: "Required documents",
          subtitle:
            "Project report, ID proof, address proof, bank statements, last ITR.",
          tone: "warn",
        },
        {
          id: "sc-channel",
          title: "Apply via your nearest DFO / Bank branch / Udyam portal",
          subtitle: "DIFO offices review; banks co-lend CGTMSE.",
          tone: "violet",
        },
      ],
      "Scheme match",
    ),
  );
  const recs: ConsultantBullet[] = [
    asBulletFor(
      "Apply PMEGP — subsidy 15-35%",
      "Submit project report + DIPP-30 acknowledgement. Subsidy released on disbursement.",
      "success",
      "Subsidy 15-35%",
      "Moderate",
      "60–90 days",
    ),
    asBulletFor(
      "Apply CGTMSE — collateral-free up to ₹5Cr",
      "Choose a partner bank; CGTMSE Trust covers 75-85% of the credit risk.",
      "info",
      "Up to ₹5 Cr",
      "Moderate",
      "45–60 days",
    ),
    asBulletFor(
      "Apply MUDRA — Shishu/Kishore/Tarun",
      "Best for first ₹50k–₹10L of working capital. No collateral required.",
      "violet",
      "Up to ₹10 L",
      "Easy",
      "30 days",
    ),
  ];
  sections.push(recommendations(recs, "Recommend schemes for you"));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.government_schemes));
}

function marketingSummary(_b: AssistantBundle, s: BusinessSnapshot, prompt: string): ConsultantSection {
  const adapt = detectAudience(prompt, _b.twin.identity.industry ?? null);
  return section("summary", "Executive Summary", {
    body: [
      audienceSummary(adapt, s.legalName),
      "The playbook below is sized to the channel cadence your customer actually buys on.",
    ].join(" "),
  });
}

function composeMarketing(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[], prompt: string): void {
  const adapt = detectAudience(prompt, b.twin.identity.industry ?? null);
  sections.push(
    findings(
      [
        {
          id: "mk-presence",
          title: `Current presence: ${s.usesDigitalMarketing ? "Yes" : "No"}`,
          tone: s.usesDigitalMarketing ? "success" : "warn",
        },
        {
          id: "mk-product",
          title: `${s.productsCount} product SKUs to market`,
          tone: "info",
        },
        {
          id: "mk-budget",
          title: "Recommended marketing budget",
          subtitle: "7-10% of monthly revenue; tracked weekly.",
          tone: "violet",
        },
        {
          id: "mk-audience",
          title: `Audience mode: ${adapt.mode}`,
          subtitle: adapt.cadenceNote,
          tone: adapt.mode === "unknown" ? "warn" : "primary",
        },
      ],
      "Marketing posture",
    ),
  );
  // P1.5 — replace the generic marketing recs with audience-specific
  // bullets (B2B → LinkedIn + ABM + trade fairs; B2C → Google
  // Business + Instagram + WhatsApp; unknown → both paths).
  const audienceBullets = audienceMarketingBullets(adapt).map((ab) =>
    asBulletFor(ab.title, ab.subtitle, ab.tone, "+30% reach", "Moderate", "2-4 weeks"),
  );
  sections.push(recommendations(audienceBullets, adapt.mode === "unknown" ? "Both B2B and B2C paths" : `${adapt.mode} marketing moves`));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.marketing));
}

function operationsSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Operations read for **${s.legalName}** (${s.employeeCount} employees, ${s.productsCount} SKUs).`,
      `Below: the three operational moves that unlock the most capacity in the shortest time.`,
    ].join(" "),
  });
}

function composeOperations(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "ops-inv",
          title: "Inventory posture",
          subtitle: "Manual or digitised — drives fill rate + supplier risk.",
          tone: "info",
        },
        {
          id: "ops-people",
          title: "People posture",
          subtitle: `${s.employeeCount} employees — bandwidth is the constraint or the asset.`,
          tone: "violet",
        },
        {
          id: "ops-flow",
          title: "Operational rhythm",
          subtitle: "Weekly review cadence is the single biggest force-multiplier.",
          tone: "info",
        },
      ],
      "Current state",
    ),
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Digitise inventory",
          "Low-cost inventory tool (Zoho / Khatabook / Vyapar) — wire SKU + supplier + min/max.",
          "success",
          "Fill rate +8%",
          "Easy",
          "2 weeks",
        ),
        asBulletFor(
          "Document SOPs for the top 3 processes",
          "Start with: order-to-cash, procure-to-pay, hire-to-retire.",
          "info",
          "Less fire-fighting",
          "Moderate",
          "3 weeks",
        ),
        asBulletFor(
          "Weekly 30-min ops review (Mon 9am)",
          "Same agenda every week. Locks accountability; lifts the team.",
          "violet",
          "Predictable throughput",
          "Easy",
          "Ongoing",
        ),
      ],
      "Recommended moves",
    ),
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.operations));
}

function hiringSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Hiring read for **${s.legalName}** — currently ${s.employeeCount} employees.`,
      `We pin the first-hire decision on operational score (${s.healthScore}/100) + DNA match (${s.dnaMatch}%) + revenue band.`,
    ].join(" "),
  });
}

function composeHiring(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "h-cap",
          title: "Capacity gap",
          subtitle: `Expected capacity gap at current growth = ~${Math.max(1, Math.round((100 - s.healthScore) / 10))} FTE.`,
          tone: "warn",
        },
        {
          id: "h-fit",
          title: "First-hire archetype",
          subtitle:
            "Pick the role that compresses your biggest constraint (sales OR ops OR finance).",
          tone: "info",
        },
        {
          id: "h-cost",
          title: "Affordability check",
          subtitle:
            s.healthScore >= 60 ? "Score supports the hire." : "Score is borderline — consider contract-to-hire first.",
          tone: s.healthScore >= 60 ? "success" : "warn",
        },
      ],
      "Should we hire?",
    ),
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Hire a sales operator (top priority if revenue < ₹2Cr)",
          "They bring pipeline + close discipline; payback typically < 4 months.",
          "primary",
          "+12 pts",
          "Moderate",
          "30 days to onboard",
        ),
        asBulletFor(
          "Hire an ops generalist (top priority if 10+ employees)",
          "Stops the founder bottleneck; unlocks 2× throughput.",
          "info",
          "+8 pts",
          "Moderate",
          "30 days to onboard",
        ),
        asBulletFor(
          "Outsource / fractional CFO (instead of full-time CFO)",
          "Use a fractional CFO for 6 hours/week — saves ₹25L/yr vs a full-time hire.",
          "violet",
          "+5 pts",
          "Easy",
          "1 week to onboard",
        ),
      ],
      "Role options — pick the one that fits your constraint",
    ),
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.hiring));
}

function complianceSummary(b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const ruleCount = b.rules.summary.total_firings;
  return section("summary", "Executive Summary", {
    body: [
      `Compliance read for **${s.legalName}** — ${ruleCount} active rule firings, ${s.activeRisks} carry risk scores.`,
      `Sorted by deadline. Critical-first.`,
    ].join(" "),
  });
}

function composeCompliance(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const ruleBullets: ConsultantBullet[] = [];
  for (const cat of Object.values(b.rules.categories) as Array<RuleCategoryBlock | null | undefined>) {
    if (!cat || !Array.isArray(cat.firings)) continue;
    for (const f of cat.firings.slice(0, 4)) {
      ruleBullets.push({
        id: f.id,
        title: f.title,
        subtitle: f.description,
        tone:
          f.priority === "Critical"
            ? "danger"
            : f.priority === "High"
              ? "warn"
              : "info",
        meta: `${f.priority} · category ${f.category.replace(/_/g, " ")}`,
      });
      if (ruleBullets.length >= 6) break;
    }
  }
  sections.push(findings(ruleBullets, "Active compliance obligations"));
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Compliance calendar",
          "Tag every due date in your CA's tracker; review weekly.",
          "primary",
          "Zero penalties",
          "Easy",
          "Ongoing",
        ),
        asBulletFor(
          "Insurance review",
          "Check if you have adequate fire + product + cyber insurance.",
          "success",
          "Risk transfer",
          "Moderate",
          "2 weeks",
        ),
        asBulletFor(
          "Annual ROC + KYC refresh",
          "Run once every quarter; bundle with your CA's review.",
          "violet",
          "Stays audit-ready",
          "Easy",
          "1 day per quarter",
        ),
      ],
      "Compliance moves",
    ),
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.compliance));
}

function riskSummary(_b: AssistantBundle, s: BusinessSnapshot, prompt: string): ConsultantSection {
  const concern = extractUserConcern(prompt);
  const ack = concern.present
    ? `You said your biggest worry is **${concern.topic}** — that leads the response, then the rule-engine layer follows.`
    : `Risk register for **${s.legalName}** — ${s.activeRisks} active risks across critical + high + medium.`;
  return section("summary", "Executive Summary", {
    body: [ack, `Sorted by impact. Top 3 below.`].join(" "),
  });
}

function composeRisk(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[], prompt: string): void {
  const top = [
    ...b.twin.risk_matrix.critical_risks,
    ...b.twin.risk_matrix.high_risks,
    ...b.twin.risk_matrix.medium_risks,
  ].slice(0, 5);
  const findingsBullets: ConsultantBullet[] = [];
  // P1.4 — user-stated concern leads the findings section.
  const concern = extractUserConcern(prompt);
  if (concern.present) {
    const lead = userConcernLeadBullet(concern, b.twin.risk_matrix.critical_risks);
    if (lead) {
      findingsBullets.push(lead);
      // Mitigation steps the user can take this week.
      findingsBullets.push({
        id: "user-concern-mitigate",
        title: `Mitigation actions for "${concern.topic}"`,
        subtitle:
          "1) Map the exposure (single-source %, top-3 customer %, etc.). 2) Qualify an alternative. 3) Lock a contractual fallback. 4) Re-review the risk register weekly.",
        tone: "info",
      });
      findingsBullets.push({
        id: "user-concern-then",
        title: "Other risks the system sees (after your stated concern)",
        subtitle: "We layer these in next — your stated concern is never buried beneath generic rule firings.",
        tone: "info",
        meta: "Layered view",
      });
    }
  }
  findingsBullets.push(
    ...top.map((r): ConsultantBullet => ({
      id: r.risk_id,
      title: r.title,
      subtitle: r.description,
      tone:
        r.priority === "Critical"
          ? "danger"
          : r.priority === "High"
            ? "warn"
            : "info",
      meta: `${r.priority} · impact ${r.estimated_impact}`,
    })),
  );
  sections.push(findings(findingsBullets, "Active risks"));
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Risk register (1 sheet, 1 owner, 1 weekly review)",
          "This is the single highest-leverage move — discipline beats tools.",
          "primary",
          "Risk culture",
          "Easy",
          "1 week to set up",
        ),
        asBulletFor(
          "Mitigation plan for the top 3 risks",
          "Map: avoiding / transferring / accepting / reducing.",
          "info",
          "-30% residual risk",
          "Moderate",
          "30 days",
        ),
        asBulletFor(
          "Insurance transfer for tail risk",
          "Fire + cyber + product + key-person insurance.",
          "violet",
          "Risk transfer",
          "Moderate",
          "60 days",
        ),
      ],
      "Risk mitigation plan",
    ),
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.risk));
}

function scalingSummary(b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  return section("summary", "Executive Summary", {
    body: [
      industryGreetingLine(adapt, "scaling", s.legalName),
      `Three vectors: (1) new geographies, (2) new channels, (3) new SKUs.`,
      `Pick the one your engine scores highest on — usually it's exports if your readiness > 50.`,
    ].join(" "),
  });
}

function composeScaling(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  const exportReadiness = b.twin.health_summary.export_readiness;
  const digitalReadiness = b.twin.health_summary.digital_maturity;
  sections.push(
    findings(
      [
        {
          id: "sc-exp",
          title: `Export readiness: ${Math.round(exportReadiness)}/100`,
          tone: exportReadiness >= 50 ? "success" : "warn",
        },
        {
          id: "sc-dig",
          title: `Digital readiness: ${Math.round(digitalReadiness)}/100`,
          tone: digitalReadiness >= 50 ? "success" : "warn",
        },
        {
          id: "sc-fit",
          title: "Scaling fit",
          tone: s.healthScore >= 60 ? "success" : "warn",
          subtitle:
            s.healthScore >= 60
              ? "Score supports a small geography rollout."
              : "Tighten operations first; revisit in 60 days.",
        },
        {
          id: "sc-industry",
          title: `Industry cluster: ${adapt.label}`,
          subtitle: `Buyer pool for new geography = ${adapt.vocabulary.buyers.slice(0, 2).join(" / ")}.`,
          tone: "violet",
        },
      ],
      "Scaling posture",
    ),
  );
  const recs: ConsultantBullet[] = [
    asBulletFor(
      "Pilot a new geography (30 days)",
      "Ship a small test shipment; verify duty + payment cycles before scaling.",
      "primary",
      "+8 pts",
      "Moderate",
      "60 days",
    ),
    asBulletFor(
      "Launch a second sales channel",
      "Marketplace OR B2B OR D2C — not all three at once.",
      "info",
      "+12 pts",
      "Moderate",
      "45 days",
    ),
    asBulletFor(
      "Add a flagship SKU to the catalogue",
      "Highest-margin / lowest-CAC line first.",
      "violet",
      "+18 pts",
      "Easy",
      "30 days",
    ),
  ];
  // P1.1 — append one industry-specific scaling bullet.
  industryPlaybookBullets(adapt, "scaling").forEach((line, i) => {
    recs.push({
      id: `sc-industry-${i}`,
      title: line,
      tone: "info",
      meta: adapt.label,
    });
  });
  sections.push(recommendations(recs, "Scaling vectors ranked"));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.scaling));
}

function whatFirstSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `What to do first for **${s.legalName}**. One critical + one high + one quick-win, in that order.`,
    ].join(" "),
  });
}

function composeWhatFirst(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const items = b.recommendations.recommendations
    .slice()
    .sort((a, b) => {
      const p = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (p !== 0) return p;
      return b.estimated_score_gain - a.estimated_score_gain;
    })
    .slice(0, 5);
  sections.push(recommendations(items.map(asBullet), "Sequenced first moves"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, items.map(asBullet)));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.what_first));
}

function exportSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const adapt = matchIndustry(_b.twin.identity.industry ?? null);
  return section("summary", "Executive Summary", {
    body: [
      industryGreetingLine(adapt, "export", s.legalName),
      `Five priority moves per category, ranked by score-gain.`,
      `Industry compliance frame: ${adapt.vocabulary.compliance[0] ?? "IEC + GST"}. Top target buyer pool: ${adapt.vocabulary.buyers[0] ?? "industrial buyer"}.`,
    ].join(" "),
  });
}

function composeExport(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  const items = b.recommendations.recommendations
    .filter((r) => r.category === "export_readiness_actions")
    .slice()
    .sort((a, b) => b.estimated_score_gain - a.estimated_score_gain)
    .slice(0, 5);
  if (items.length === 0) {
    // P1.1 — when no export recommendations exist, surface industry-
    // specific export first steps instead of "Update the Business
    // Profile." For Textiles & Apparel this means IEC + HSN + buyer
    // list; for Manufacturing this means ISO 9001 + GeM registration;
    // for Retail / D2C this means Amazon Global / Etsy B2B.
    const play = industryPlaybookBullets(adapt, "export");
    sections.push(
      findings(
        play.map((line, i) => ({
          id: `exp-play-${i}`,
          title: line,
          tone: "warn",
        })),
        `Export roadmap · ${adapt.label}`,
      ),
    );
  } else {
    sections.push(recommendations(items.map(asBullet), "Top 5 export plays"));
  }
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.export_opportunities));
}

function dnaSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Business DNA for **${s.legalName}** is ${s.dnaArchetype} at ${s.dnaMatch}% match.`,
      `Everything below is calibrated to this archetype.`,
    ].join(" "),
  });
}

function composeDna(_b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "dna-arch",
          title: s.dnaArchetype,
          subtitle: `Match score ${s.dnaMatch}%`,
          tone: "violet",
        },
        {
          id: "dna-scores",
          title: "Pillars that define the archetype",
          tone: "info",
          meta: "Computed from your business profile signals.",
        },
      ],
      "Archetype read",
    ),
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Double down on what the archetype values",
          "If the archetype is operational, lean into SOPs + capacity.",
          "primary",
          "+5 pts",
          "Easy",
          "1 week",
        ),
        asBulletFor(
          "Avoid archetype risks",
          "Foundations grind on cash-flow; Leaders stretch on hiring.",
          "info",
          "Risk reduction",
          "Easy",
          "1 day",
        ),
        asBulletFor(
          "Improve DNA match to 75%+",
          "Higher match = better recommendations; lower match = wider variance.",
          "violet",
          "+5% match",
          "Moderate",
          "1 month",
        ),
      ],
      "DNA-driven recommendations",
    ),
  );
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.business_dna));
}

function roadmapSummary(b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Your roadmap has **${s.roadmapTotalItems} items** projected across **${b.roadmap.summary.total_estimated_duration}**.`,
      `Projected end-state: business score ${s.projectedScore}/100, +${s.estimatedScoreGain} pts, ~${s.estimatedRoi}% modelled ROI.`,
    ].join(" "),
  });
}

function composeRoadmap(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const items: ConsultantBullet[] = b.roadmap.items.slice(0, 5).map((it) => ({
    id: it.recommendation_id,
    title: it.title,
    subtitle: `${it.phase} · priority ${it.priority}`,
    tone: "info",
    impact: `+${Math.round(it.expected_score_improvement || 0)} pts · ${Math.round(it.estimated_roi || 0)}% ROI`,
    time: it.estimated_duration,
  }));
  sections.push(recommendations(items, "Roadmap by phase"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_roadmap));
}

function recommendationsSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Recommendations queue for **${s.legalName}**: ${s.recommendationCount} items, ${s.criticalRecommendations} critical + ${s.highRecommendations} high.`,
    ].join(" "),
  });
}

function composeRecommendations(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(recommendations(b.recommendations.recommendations.slice(0, 5).map(asBullet), "Top recommendations"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_recommendations));
}

function insightsSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `AI Decision insights for ${s.legalName}. Below: the top 5 insights + how each is grounded.`,
    ].join(" "),
  });
}

function composeInsights(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const decision = b.decision;
  if (!decision) {
    sections.push(
      findings(
        [
          {
            id: "ins-none",
            title: "No AI Decision output yet",
            subtitle: "Re-run the advisor to refresh insights.",
            tone: "warn",
          },
        ],
        "Insights",
      ),
    );
  } else {
    sections.push(
      findings(
        decision.decision.insights.slice(0, 5).map((ins) => ({
          id: ins.id,
          title: ins.title,
          subtitle: ins.explanation,
          tone:
            ins.priority === "Critical"
              ? "danger"
              : ins.priority === "High"
                ? "warn"
                : "info",
          meta: `${ins.priority} · confidence ${ins.confidence}%`,
        })),
        "Top insights",
      ),
    );
  }
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_insights));
}

function rulesSummaryFn(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Active rule firings: **${s.rulesFiring}**. Each one is a direct opportunity waiting to be actioned.`,
    ].join(" "),
  });
}

function composeRulesFn(b: AssistantBundle, _s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const items: ConsultantBullet[] = [];
  for (const cat of Object.values(b.rules.categories) as Array<RuleCategoryBlock | null | undefined>) {
    if (!cat || !Array.isArray(cat.firings)) continue;
    for (const f of cat.firings.slice(0, 3)) {
      items.push({
        id: f.id,
        title: f.title,
        subtitle: f.description,
        tone: f.priority === "Critical" ? "danger" : f.priority === "High" ? "warn" : "info",
        meta: `${f.priority} · ${f.category.replace(/_/g, " ")}`,
      });
    }
  }
  sections.push(findings(items, "Top rule firings"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_rules));
}

function overviewSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Business overview for **${s.legalName}**. Score **${s.healthScore}/100** (${s.healthBand}), DNA ${s.dnaArchetype} at ${s.dnaMatch}%, ${s.rulesFiring} rule firings, ${s.recommendationCount} actions queued.`,
    ].join(" "),
  });
}

function composeOverview(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(
    findings(
      [
        {
          id: "ov-score",
          title: `Overall score: ${s.healthScore}/100 (${s.healthBand})`,
          tone: s.healthScore >= 60 ? "success" : "warn",
        },
        {
          id: "ov-dna",
          title: `DNA: ${s.dnaArchetype} (${s.dnaMatch}%)`,
          tone: "violet",
        },
        {
          id: "ov-recs",
          title: `${s.recommendationCount} recommendations queued`,
          tone: "info",
          subtitle: `${s.criticalRecommendations} critical · ${s.highRecommendations} high`,
        },
        {
          id: "ov-roadmap",
          title: `Roadmap: ${s.roadmapTotalItems} items, projected score ${s.projectedScore}/100`,
          tone: "info",
        },
      ],
      "The big picture",
    ),
  );
  sections.push(
    recommendations(
      bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 5),
      "Where to start",
    ),
  );
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.general_overview));
}

function decisionHireSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  const verdict = decideHireVerdict(s);
  return section("summary", "Executive Summary", {
    body: [
      `**Should I hire?** for ${s.legalName} — ${verdict === "YES" ? "yes" : verdict === "WAIT" ? "wait" : "not yet"} (verdict: ${verdict}).`,
      `Three forces drive the verdict: business score, DNA match, and revenue band.`,
    ].join(" "),
  });
}

function decideHireVerdict(s: BusinessSnapshot): "YES" | "WAIT" | "NO" {
  if (s.healthScore >= 55 && s.dnaMatch >= 40) return "YES";
  if (s.healthScore >= 40 && s.healthScore < 55) return "WAIT";
  return "NO";
}

function composeDecisionHire(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(decisionSectionFor(b, s, "hire"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_hire));
}

function decisionExpandSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `**Should I expand?** for ${s.legalName} — depends on export readiness + digital readiness + score.`,
      `The card below gives a deterministic verdict + the ROI, timeline and risk lines.`,
    ].join(" "),
  });
}

function composeDecisionExpand(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(decisionSectionFor(b, s, "expand"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_expand));
}

function decisionLoanSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `**Should I apply for a loan?** for ${s.legalName}.`,
      `The card below gives the verdict + interest-rate band and the docs you'll need.`,
    ].join(" "),
  });
}

function composeDecisionLoan(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  sections.push(decisionSectionFor(b, s, "loan"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_loan));
}

function actionPlanSummary(_b: AssistantBundle, s: BusinessSnapshot, _p: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `Action plan for **${s.legalName}** — 4-week ramp for the highest-leverage move.`,
      `Each week is a checkpoint; each step is one person-day of work.`,
    ].join(" "),
  });
}

function composeActionPlan(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  const top = s.topRecommendations[0];
  if (top) {
    const rec = b.recommendations.recommendations.find((r) => r.id === top.id);
    if (rec) {
      sections.push(actionPlanSection(b, s, [asBullet(rec)]));
    }
  }
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.action_plan));
}

function fallbackSummary(b: AssistantBundle, _s: BusinessSnapshot, prompt: string): ConsultantSection {
  return section("summary", "Executive Summary", {
    body: [
      `I read your question ("${prompt.slice(0, 240)}") against every payload the platform tracks.`,
      `The closest intent I found matches the general overview. If that doesn't fit, try one of the Next Questions below.`,
    ].join(" "),
  });
}

function composeFallback(b: AssistantBundle, s: BusinessSnapshot, sections: ConsultantSection[]): void {
  composeOverview(b, s, sections);
}

// --------------------------------------------------------------------------- //
// Decision / action-plan helpers                                          //
// --------------------------------------------------------------------------- //

function decisionSectionFor(
  b: AssistantBundle,
  s: BusinessSnapshot,
  kind: "hire" | "expand" | "loan",
): ConsultantSection {
  const payload = buildDecisionCard(b, s, kind);
  return section("decision", "Decision support", {
    caption: `${payload.question} · verdict ${payload.verdict}`,
    decision: payload,
  });
}

function buildDecisionCard(
  b: AssistantBundle,
  s: BusinessSnapshot,
  kind: "hire" | "expand" | "loan",
): DecisionCardPayload {
  if (kind === "hire") {
    const ready = s.healthScore >= 55 && s.dnaMatch >= 40;
    const borderline = s.healthScore >= 40 && s.healthScore < 55;
    const verdict: DecisionCardPayload["verdict"] = ready
      ? "YES"
      : borderline
        ? "WAIT"
        : "NO";
    const verdictTone: DecisionCardPayload["verdictTone"] =
      verdict === "YES" ? "success" : verdict === "WAIT" ? "warn" : "danger";
    return {
      question: "Should I Hire?",
      verdict,
      verdictTone,
      headline:
        verdict === "YES"
          ? "Hire now — operational score is above threshold."
          : verdict === "WAIT"
            ? "Hold — stabilise the baseline first."
            : "Not yet — too many open risks on the table.",
      why: `Score ${s.healthScore}/100 (${s.healthBand}), DNA match ${s.dnaMatch}%, revenue band ${s.revenueBand.label}.`,
      risks:
        verdict === "YES"
          ? [
              "Cash-buffer compression if payroll slips.",
              "Wrong hire burns 3 months of runway.",
            ]
          : ["Adding fixed cost before runway clears will compound the score gap."],
      roi: verdict === "YES" ? "Sales hire: payback <4 months · Ops hire: 30-50% throughput lift" : "Outsource / fractional first — better ROI while score rebuilds.",
      timeline: ready ? "30 days to onboard" : "Re-evaluate in 60 days",
      confidence: clampScore(40 + s.healthScore / 2 - s.activeRisks * 4),
    };
  }
  if (kind === "expand") {
    const exportReady = b.twin.health_summary.export_readiness;
    const digitalReady = b.twin.health_summary.digital_maturity;
    const ready = s.healthScore >= 60 && exportReady >= 50;
    const borderline = s.healthScore >= 45 && s.healthScore < 60;
    const verdict: DecisionCardPayload["verdict"] = ready
      ? "YES"
      : borderline
        ? "WAIT"
        : "NO";
    const verdictTone: DecisionCardPayload["verdictTone"] =
      verdict === "YES" ? "success" : verdict === "WAIT" ? "warn" : "danger";
    return {
      question: "Should I Expand?",
      verdict,
      verdictTone,
      headline:
        verdict === "YES"
          ? "Open a new geography or channel this quarter."
          : verdict === "WAIT"
            ? "Wait — close the operational baseline first."
            : "Defend the core first.",
      why: `Score ${s.healthScore}/100, export readiness ${Math.round(exportReady)}, digital readiness ${Math.round(digitalReady)}.`,
      risks:
        verdict === "YES"
          ? [
              "FX + duty exposure on the new geography.",
              "Hiring / logistics capacity strain if the pilot scales.",
            ]
          : ["Expanding before the baseline is set amplifies whatever is broken."],
      roi: "New geography: 2× revenue, 6-12 months payback. New channel: 30-45 days to validation.",
      timeline: ready ? "30-day pilot, 90-day scale decision" : "Re-evaluate in 90 days",
      confidence: clampScore(45 + (s.healthScore / 2) - s.activeRisks * 3),
    };
  }
  // loan
  const loanReady = b.recommendations.summary.total_estimated_roi >= 35 && s.healthScore >= 50;
  const borderline = s.healthScore >= 40 && s.healthScore < 50;
  const verdict: DecisionCardPayload["verdict"] = loanReady
    ? "YES"
    : borderline
      ? "WAIT"
      : "NO";
  const verdictTone: DecisionCardPayload["verdictTone"] =
    verdict === "YES" ? "success" : verdict === "WAIT" ? "warn" : "danger";
  return {
    question: "Should I apply for a Loan?",
    verdict,
    verdictTone,
    headline:
      verdict === "YES"
        ? "Apply now — readiness score supports approval."
        : verdict === "WAIT"
          ? "Build the readiness checklist first."
          : "Not yet — readiness score is below threshold.",
    why: `Score ${s.healthScore}/100, total estimated ROI ${s.estimatedRoi}%, capital-readiness inference from score.`,
    risks:
      verdict === "YES"
        ? [
            "Fixed cost if revenue doesn't lift as forecast.",
            "Collateral exposure if the loan is secured.",
          ]
        : ["Borrowing without readiness compounds the score gap."],
    roi: "Effective rate 9-14% for collateral-free (CGTMSE), 10-12% for term loan.",
    timeline:
      loanReady
        ? "45-60 days from application to disbursement"
        : "Re-evaluate in 90 days",
    confidence: clampScore(40 + s.healthScore / 2 + (s.estimatedRoi > 35 ? 8 : 0)),
  };
}

function actionPlanSection(
  b: AssistantBundle,
  s: BusinessSnapshot,
  bullets: ConsultantBullet[],
): ConsultantSection {
  const empty: ConsultantSection = {
    key: "action_plan",
    title: "Week-by-week action plan",
    caption: "Action plan will populate once a top recommendation is selected.",
    weeks: [],
  };
  if (bullets.length === 0) return empty;
  const top = bullets[0];
  const rec = b.recommendations.recommendations.find((r) => r.title === top.title);
  const weeks = rec ? actionWeeksFromRecommendation(rec) : generateGenericWeeks(top.title);
  return section("action_plan", "Week-by-week action plan", {
    caption: `Plan for "${top.title}" — ${b.roadmap.summary.total_estimated_duration} target.`,
    weeks,
  });
}

function generateGenericWeeks(title: string): ActionWeek[] {
  return actionWeeksFromRecommendation({
    id: "generic",
    title,
    category: "high_priority",
    priority: "High",
  } as RecommendationItem);
}

// --------------------------------------------------------------------------- //
// Citation sources                                                         //
// --------------------------------------------------------------------------- //

function commonSources(topics: string[]): ConsultantResponse["sources"] {
  return topics.map((topic) => ({
    topic: topic as
      | "Twin"
      | "Recommendations"
      | "Roadmap"
      | "Insights"
      | "Rules"
      | "Business DNA"
      | "Export",
    detail: `Drawn from the ${topic} payload.`,
  }));
}

function improveSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Recommendations", "Roadmap"]);
}
function lowScoreSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Recommendations", "Rules"]);
}
function growthSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Marketing", "Roadmap"]);
}
function digitalSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Digital", "Roadmap"]);
}
function financeSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Government Schemes", "Recommendations"]);
}
function overviewSources(b: AssistantBundle, s: BusinessSnapshot) {
  return commonSources(["Twin", "Recommendations", "Roadmap", "Business DNA", "Rules"]);
}

// --------------------------------------------------------------------------- //
// Plain-text fallback renderer                                             //
// --------------------------------------------------------------------------- //

function renderPlainText(
  sections: ConsultantSection[],
  _snapshot: BusinessSnapshot,
): string {
  const lines: string[] = [];
  for (const s of sections) {
    if (s.key === "decision") continue;
    lines.push(s.title);
    if (s.caption) lines.push(s.caption);
    if (s.body) lines.push(s.body);
    if (s.lines) {
      for (const l of s.lines) lines.push(`- ${l}`);
    }
    if (s.bullets) {
      for (const b of s.bullets) {
        let line = `- ${b.title}`;
        if (b.subtitle) line = `${line} — ${b.subtitle}`;
        if (b.impact) line = `${line} (${b.impact})`;
        lines.push(line);
      }
    }
    if (s.weeks) {
      for (const w of s.weeks) {
        lines.push(`\n${w.week}`);
        for (const step of w.steps) lines.push(`- ${step}`);
      }
    }
    lines.push("");
  }
  return lines.filter(Boolean).join("\n").trim();
}

function priorityWeight(p: string): number {
  if (p === "Critical") return 0;
  if (p === "High") return 1;
  if (p === "Medium") return 2;
  return 3;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asBulletFor(
  title: string,
  subtitle: string,
  tone: ConsultantBullet["tone"],
  impact: string,
  difficulty: string,
  time: string,
): ConsultantBullet {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    subtitle,
    tone,
    impact,
    difficulty,
    time,
    confidence: 75,
    riskIfIgnored: "Score will stay flat for the next quarter.",
  };
}

// --------------------------------------------------------------------------- //
// Next questions catalogue                                                 //
// --------------------------------------------------------------------------- //

const NEXT_QUESTIONS: Partial<Record<QueryKind, Array<{ id: string; label: string }>>> = {
  improve_business: [
    { id: "ib-quick", label: "Give me a quick win" },
    { id: "ib-budget", label: "What can I do with a small budget?" },
    { id: "ib-deadline", label: "Which action has the shortest timeline?" },
  ],
  low_score: [
    { id: "ls-quick-win", label: "Show me a quick win" },
    { id: "ls-rule", label: "Explain the engine findings" },
    { id: "ls-roadmap", label: "Walk me through the roadmap" },
  ],
  growth_strategy: [
    { id: "gs-channel", label: "Best channel for me" },
    { id: "gs-export", label: "Export opportunities" },
    { id: "gs-plan", label: "Build me a quarterly plan" },
  ],
  digital_transformation: [
    { id: "dt-website", label: "Should I launch a website?" },
    { id: "dt-payments", label: "Set up digital payments" },
    { id: "dt-roi", label: "What is the ROI?" },
  ],
  finance: [
    { id: "fin-cost", label: "Cost of capital" },
    { id: "fin-loan", label: "Should I apply for a loan?" },
    { id: "fin-cash", label: "Cash-flow plan" },
  ],
  gst: [
    { id: "gst-cost", label: "Costs" },
    { id: "gst-deadline", label: "Deadline" },
    { id: "gst-penalty", label: "Penalties" },
  ],
  government_schemes: [
    { id: "gs-elig", label: "Check Eligibility" },
    { id: "gs-compare", label: "Compare with MUDRA" },
    { id: "gs-docs", label: "Required Documents" },
  ],
  marketing: [
    { id: "mkt-channel", label: "Best channel for me" },
    { id: "mkt-budget", label: "Cheapest acquisition" },
    { id: "mkt-content", label: "Content cadence" },
  ],
  operations: [
    { id: "ops-inv", label: "Digitise inventory" },
    { id: "ops-hire", label: "Should I Hire?" },
    { id: "ops-supplier", label: "Supplier risk" },
  ],
  hiring: [
    { id: "h-yes", label: "Should I Hire?" },
    { id: "h-role", label: "First role" },
    { id: "h-cost", label: "Cost of hire" },
  ],
  compliance: [
    { id: "c-list", label: "Full compliance checklist" },
    { id: "c-tax", label: "Tax calendar" },
    { id: "c-penalty", label: "Risk of ignoring" },
  ],
  risk: [
    { id: "r-top", label: "Top 3 risks" },
    { id: "r-mitigate", label: "Mitigation plan" },
    { id: "r-insurance", label: "Insurance options" },
  ],
  scaling: [
    { id: "sc-expand", label: "Should I Expand?" },
    { id: "sc-hire", label: "Hire for scale" },
    { id: "sc-finance", label: "Capital for scale" },
  ],
  decision_hire: [
    { id: "dh-role", label: "What role?" },
    { id: "dh-cost", label: "Cost calculator" },
    { id: "dh-alt", label: "Outsource alternative" },
  ],
  decision_expand: [
    { id: "de-market", label: "Best market to enter" },
    { id: "de-cost", label: "Cost of expansion" },
    { id: "de-risk", label: "Expansion risk" },
  ],
  decision_loan: [
    { id: "dl-scheme", label: "Government loan instead?" },
    { id: "dl-readiness", label: "Loan readiness score" },
    { id: "dl-cost", label: "Effective interest rate" },
  ],
  action_plan: [
    { id: "ap-track", label: "Track progress" },
    { id: "ap-risk", label: "Risk if I skip a week" },
    { id: "ap-review", label: "Monthly review cadence" },
  ],
  what_first: [
    { id: "wf-quick", label: "Quickest first move" },
    { id: "wf-recs", label: "Explain the priority list" },
    { id: "wf-roadmap", label: "Walk me through the roadmap" },
  ],
  export_opportunities: [
    { id: "exp-elig", label: "Check my export eligibility" },
    { id: "exp-mkt", label: "Best markets for my product" },
    { id: "exp-docs", label: "Required documents" },
  ],
  business_dna: [
    { id: "dna-improve", label: "Improve my DNA match" },
    { id: "dna-archetype", label: "What does my archetype value?" },
    { id: "dna-industry", label: "How do my peers score?" },
  ],
  explain_roadmap: [
    { id: "rm-first", label: "Which phase first?" },
    { id: "rm-deps", label: "Dependencies that block" },
    { id: "rm-duration", label: "How long is the roadmap?" },
  ],
  explain_recommendations: [
    { id: "rc-critical", label: "Most critical recommendation" },
    { id: "rc-cheap", label: "Cheapest recommendation" },
    { id: "rc-fast", label: "Fastest recommendation" },
  ],
  explain_insights: [
    { id: "in-patterns", label: "Patterns in my business" },
    { id: "in-low", label: "Where is my analysis weakest?" },
    { id: "in-summary", label: "One-line summary" },
  ],
  explain_rules: [
    { id: "rul-crit", label: "Critical rules" },
    { id: "rul-resolved", label: "Resolved rules" },
    { id: "rul-impact", label: "Highest-impact rule" },
  ],
  general_overview: [
    { id: "ov-health", label: "Business health" },
    { id: "ov-dna", label: "Explain my Business DNA" },
    { id: "ov-recs", label: "Show top recommendations" },
  ],
  growth_target: [
    { id: "gt-check", label: "Re-check the projection after Month 1" },
    { id: "gt-lever1", label: "Help me design Lever 1 (existing customers)" },
    { id: "gt-export", label: "How does export factor in?" },
  ],
  product_help: [
    { id: "ph-more", label: "Tell me more about UrsBiz" },
    { id: "ph-export", label: "What is export a conversation?" },
    { id: "ph-reports", label: "Where can I find my reports?" },
  ],
};

// --------------------------------------------------------------------------- //
// P1 — Growth-target composer (kind="growth_target")                         //
// --------------------------------------------------------------------------- //

/**
 * Executive summary for a growth-target prompt. Uses scenario
 * language ("To target", "Potential path", "Assuming") so we
 * never guarantee revenue growth.
 */
function growthTargetSummary(
  _b: AssistantBundle,
  _s: BusinessSnapshot,
  prompt: string,
): ConsultantSection {
  const target = extractGrowthTarget(prompt);
  const adapt = matchIndustry(_b.twin.identity.industry ?? null);
  const body = growthTargetBody(target, adapt);
  return section("summary", "Executive Summary", {
    caption: `Growth target read · ${adapt.label} · scenario language — no revenue guarantee.`,
    body,
  });
}

/**
 * Composer for the growth_target route. Emits:
 *   - Summary (scenario body)
 *   - Findings (current, target, gap, horizon — three bullets)
 *   - Recommendations (4-5 growth levers, ranked by ease)
 *   - Impact (assumptions + risks — scenario-shaped)
 *   - Action plan (4 weeks, gated around levers 1/2/3 + de-risk)
 *   - Next questions
 */
function composeGrowthTarget(
  b: AssistantBundle,
  s: BusinessSnapshot,
  sections: ConsultantSection[],
  prompt: string,
): void {
  const target = extractGrowthTarget(prompt);
  const adapt = matchIndustry(b.twin.identity.industry ?? null);
  // Findings — current / target / gap / horizon
  const findingsBullets: ConsultantBullet[] = [];
  if (target.currentInr !== null) {
    findingsBullets.push({
      id: "gt-current",
      title: `Current: ${formatInr(target.currentInr)}`,
      subtitle: "Baseline from your prompt (or your profile's annual revenue if not stated).",
      tone: "info",
    });
  }
  if (target.targetInr !== null) {
    findingsBullets.push({
      id: "gt-target",
      title: `Target: ${formatInr(target.targetInr)}`,
      subtitle: target.horizon ? `Within ${target.horizon}` : "Horizon not stated",
      tone: "primary",
    });
  }
  if (target.gapInr !== null) {
    findingsBullets.push({
      id: "gt-gap",
      title: `Gap: ${formatInr(target.gapInr)}${
        target.multiplier ? ` (${Math.round(target.multiplier * 100) / 100}×)` : ""
      }`,
      subtitle: "The revenue delta the levers below need to close.",
      tone: target.gapInr > 0 ? "warn" : "success",
    });
  }
  // Industry-adaptive context bullet
  findingsBullets.push({
    id: "gt-industry",
    title: `Industry context: ${adapt.label}`,
    subtitle: `Discovery channel anchor — ${adapt.vocabulary.channels[0] ?? "industry-typical channel"}.`,
    tone: "violet",
  });
  sections.push(section("findings", "The gap", { bullets: findingsBullets }));

  // Recommendations — 4 standard levers, ordered by ease.
  const leverBullets: ConsultantBullet[] = GROWTH_LEVERS.map((lever, i) => ({
    id: `lever-${i + 1}`,
    title: lever.title,
    subtitle: lever.subtitle,
    tone: i === 0 ? "primary" : i === 1 ? "info" : i === 2 ? "info" : i === 3 ? "violet" : "violet",
    meta: "Growth lever",
    difficulty: i <= 1 ? "Moderate" : "Easy",
    time: i === 0 ? "30 days" : i === 1 ? "60 days" : i === 2 ? "90 days" : "120 days",
    confidence: 65,
  }));
  sections.push(section("recommendations", "Growth levers (ranked by ease)", { bullets: leverBullets }));

  // Impact — scenario language, no guarantees.
  sections.push(
    impactLines(
      [
        "**To target** the gap above, assume Levers 1-2 close 40-60% and Levers 3-4 close 20-30% over 4-6 months.",
        "**Assuming** current product mix + pricing, the first lever alone typically closes 25-40% of the gap.",
        "**Risks** — large gaps assume price uplift (often unrealistic) or significant new-customer acquisition (depends on market growth, not effort).",
      ],
      "Estimated impact (scenario)",
    ),
  );

  // Action plan — 4 weeks, scenario-aware.
  const weeks = growthTargetWeeks(
    target.currentInr,
    target.targetInr,
    target.horizon,
    adapt,
  );
  sections.push({
    key: "action_plan",
    title: "Phased action plan (4 weeks, scenario)",
    caption: `Plan for ${formatInr(target.targetInr ?? 0)} within ${target.horizon ?? "the requested horizon"}.`,
    weeks: normalizeActionWeeks(weeks),
  });

  sections.push(
    nextQuestionsLabels([
      { id: "gt-check", label: "Re-check the projection after Month 1" },
      { id: "gt-lever1", label: "Help me design Lev er 1 (existing customers)" },
      { id: "gt-export", label: "How does export factor in?" },
    ]),
  );
}

// --------------------------------------------------------------------------- //
// P1 — Product-help composer (kind="product_help")                            //
// --------------------------------------------------------------------------- //

function productHelpSummary(
  _b: AssistantBundle,
  _s: BusinessSnapshot,
  prompt: string,
): ConsultantSection {
  const detect = detectProductHelp(prompt);
  const help = productHelpBody(detect.topic);
  return section("summary", "Executive Summary", {
    caption: "UrsBiz product help — UI steps, not business advice.",
    body: help.body,
  });
}

function composeProductHelp(
  _b: AssistantBundle,
  _s: BusinessSnapshot,
  sections: ConsultantSection[],
  prompt: string,
): void {
  const detect = detectProductHelp(prompt);
  const help = productHelpBody(detect.topic);
  sections.push(
    section("recommendations", "Steps in UrsBiz", {
      bullets: help.bullets.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        tone: "info" as const,
      })),
    }),
  );
  sections.push(
    nextQuestionsLabels([
      { id: "ph-more", label: "Tell me more about UrsBiz" },
      { id: "ph-export", label: "What is export a conversation?" },
      { id: "ph-reports", label: "Where can I find my reports?" },
    ]),
  );
}

// Re-export format helpers for downstream components.
export { formatRoi, formatScoreGain };

// Force usage of TwinResponse / RecommendationItem / etc. for the module
// so existing import graph still resolves even if not directly used.
export type _AssistantBundle = AssistantBundle;
export type _TwinResponse = TwinResponse;
export type _RecommendationsResponse = RecommendationsResponse;
export type _RoadmapResponse = RoadmapResponse;
export type _RulesResponse = RulesResponse;
export type _AIDecisionResponse = AIDecisionResponse;

import { formatScoreGain as _fmtScoreGain } from "./format-numbers";
import { formatRoi as _fmtRoi } from "./format-numbers";
void _fmtScoreGain;
void _fmtRoi;
