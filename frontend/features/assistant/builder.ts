/**
 * Deterministic Assistant response builder.
 *
 * Frontend only. This module is the *engine* of the
 * AI Business Assistant UI — every assistant message
 * is built here, locally, from the five upstream payloads
 * the rest of the app already uses:
 *
 *   - Twin                  identity, scores, DNA, opportunities
 *   - Recommendations       prioritised improvement items
 *   - Roadmap               sequenced, dependency-aware plan
 *   - Insights (Decision)   AI Decision engine output
 *   - Rules                 raw rule firings, by category
 *
 * No LLM call. No external service. The output is a
 * function of the input — given the same five payloads
 * the builder returns the same `AssistantResponse`
 * every time, which is the property the user verifies.
 *
 * The builder is keyed on a `QueryKind` (the deterministic
 * intent classifier in `classify-query.ts` picks one
 * for every user prompt). Each kind has a small
 * dedicated function; the `FALLBACK` builder is a
 * general-purpose overview that combines every payload.
 */

import type {
  AIDecisionResponse,
  RuleFiring,
  RulesResponse,
} from "@/types/dashboard";
import type {
  RecommendationItem,
  RecommendationsResponse,
  RoadmapItem,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import type {
  AssistantResponse,
  ChatSource,
  QueryKind,
} from "./types";

// --------------------------------------------------------------------------- //
// Bundle — the five payloads the builder reads from.
// --------------------------------------------------------------------------- //

export interface AssistantBundle {
  twin: TwinResponse;
  recommendations: RecommendationsResponse;
  roadmap: RoadmapResponse;
  rules: RulesResponse;
  decision: AIDecisionResponse | null;
}

const EMPTY = "";

// --------------------------------------------------------------------------- //
// Shared helpers
// --------------------------------------------------------------------------- //

function bandForScore(score: number): string {
  if (score >= 75) return "Leading";
  if (score >= 50) return "Established";
  if (score >= 25) return "Developing";
  return "Foundation";
}

function phaseOrder(phase: string): number {
  // Map roadmap phases to a numeric ordering so we can pick the
  // "most-advanced populated" one. "Immediate" is the earliest.
  switch (phase) {
    case "Immediate":
      return 0;
    case "Short-Term":
      return 1;
    case "Medium-Term":
      return 2;
    case "Long-Term":
      return 3;
    default:
      return -1;
  }
}

function priorityRank(priority: RuleFiring["priority"]): number {
  switch (priority) {
    case "Critical":
      return 0;
    case "High":
      return 1;
    case "Medium":
      return 2;
    case "Low":
      return 3;
    default:
      return 99;
  }
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
}

function fmtMoney(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  // Compact display: 1.2k / 3.4M. The recommendations engine
  // reports totals; the assistant surfaces the rounded value.
  const abs = Math.abs(value);
  let scaled = value;
  let suffix = "";
  if (abs >= 1_000_000) {
    scaled = value / 1_000_000;
    suffix = "M";
  } else if (abs >= 1_000) {
    scaled = value / 1_000;
    suffix = "k";
  }
  const fixed = abs >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `${currency === "USD" ? "$" : ""}${fixed}${suffix}`;
}

function pickTopRecommendations(
  recs: RecommendationItem[],
  limit: number,
  filter: (r: RecommendationItem) => boolean = () => true,
): RecommendationItem[] {
  return recs
    .filter(filter)
    .slice()
    .sort((a, b) => {
      // Sort by priority first, then by score gain, then ROI.
      const p = priorityRank(a.priority) - priorityRank(b.priority);
      if (p !== 0) return p;
      if (b.estimated_score_gain !== a.estimated_score_gain) {
        return b.estimated_score_gain - a.estimated_score_gain;
      }
      return b.estimated_roi - a.estimated_roi;
    })
    .slice(0, limit);
}

function pickExportOpportunities(
  recs: RecommendationItem[],
  twin: TwinResponse,
): RecommendationItem[] {
  // Pull recommendations whose category maps to export readiness
  // and that the Twin opportunity_matrix also flagged.
  const twinExportTitles = new Set(
    twin.opportunity_matrix.export_opportunities.map((e) => e.title),
  );
  const exportCategoryRecs = recs.filter(
    (r) => r.category === "export_readiness_actions",
  );
  // Prefer twin-curated export opportunities first, then fall back
  // to the export-category recommendations the engine produced.
  const matched = exportCategoryRecs.filter((r) => twinExportTitles.has(r.title));
  if (matched.length > 0) return pickTopRecommendations(matched, 5);
  return pickTopRecommendations(exportCategoryRecs, 5);
}

function pickFirstRoadmapItem(roadmap: RoadmapResponse): RoadmapItem | null {
  // Roadmap items come from the engine already in `estimated_start_order`
  // ascending; sort defensively in case the upstream ordering drifts.
  if (roadmap.items.length === 0) return null;
  const sorted = roadmap.items
    .slice()
    .sort((a, b) => a.estimated_start_order - b.estimated_start_order);
  return sorted[0];
}

function topRulesByPriority(
  rules: RulesResponse,
  limit: number,
): RuleFiring[] {
  const out: RuleFiring[] = [];
  for (const block of Object.values(rules.categories)) {
    if (!block || !Array.isArray(block.firings)) continue;
    for (const f of block.firings) {
      out.push(f);
    }
  }
  return out
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, limit);
}

function uniqueSources(items: ChatSource[]): ChatSource[] {
  // Dedup by topic preserving order — keeps the source list
  // readable when the response draws on the same payload twice.
  const seen = new Set<string>();
  const out: ChatSource[] = [];
  for (const s of items) {
    if (seen.has(s.topic)) continue;
    seen.add(s.topic);
    out.push(s);
  }
  return out;
}

// --------------------------------------------------------------------------- //
// Per-kind builders
// --------------------------------------------------------------------------- //

function buildImproveBusiness(bundle: AssistantBundle): AssistantResponse {
  const { twin, recommendations, roadmap } = bundle;
  const overall = twin.current_health.overall_business_score;
  const band = bandForScore(overall);

  const top = pickTopRecommendations(recommendations.recommendations, 3);
  const bulletBlock = top
    .map(
      (r, i) =>
        `- ${i + 1}. ${r.title} (${r.priority} priority, +${r.estimated_score_gain} score, ~${r.estimated_timeline})`,
    )
    .join("\n");

  const summaryLine =
    `Your business currently sits at ${overall}/100 (${band}). The fastest improvements are below.`;

  const topRecTitle = top[0]?.title ?? "the top recommendation";
  const closingLine = `\n\nA good starting point: tackle "${topRecTitle}" first — it has the highest priority and the largest expected score gain. The roadmap already sequences it as item #${roadmap.items.find((it) => it.recommendation_id === top[0]?.id)?.estimated_start_order ?? 1}.`;

  return {
    body: `${summaryLine}\n\n${bulletBlock}${closingLine}`,
    sources: [
      { topic: "Twin", detail: `Overall score ${overall}/100 (${band}).` },
      { topic: "Recommendations", detail: `${top.length} highest-priority improvements surfaced.` },
      { topic: "Roadmap", detail: `Sequenced to start with the highest-priority item.` },
    ],
    kind: "improve_business",
  };
}

function buildLowScore(bundle: AssistantBundle): AssistantResponse {
  const { twin, recommendations, rules } = bundle;
  const overall = twin.current_health.overall_business_score;
  const band = bandForScore(overall);

  // Surface the largest-score-gain recommendations to address the
  // biggest contributors to the low score.
  const sortedByGain = pickTopRecommendations(
    recommendations.recommendations.filter(
      (r) => r.priority === "Critical" || r.priority === "High",
    ),
    4,
  );

  const lowPillars: string[] = [];
  for (const s of twin.scores.scores) {
    if (s.score < 40) {
      lowPillars.push(`${s.title.toLowerCase()} (${s.score}/100)`);
    }
  }
  const pillarsLine =
    lowPillars.length > 0
      ? `\n\nLowest pillars right now: ${lowPillars.join(", ")}.`
      : "";

  const bulletBlock = sortedByGain
    .map(
      (r, i) =>
        `- ${i + 1}. ${r.title} — +${r.estimated_score_gain} score, category: ${r.category.replace(/_/g, " ")}`,
    )
    .join("\n");

  const ruleCount = rules.summary.total_firings;
  const ruleLine =
    ruleCount > 0
      ? ` The rule engine has ${ruleCount} active firings behind these recommendations.`
      : "";

  return {
    body:
      `Your overall score is ${overall}/100 (${band}).` +
      ` The biggest drags are the rules firing under the lowest-priority lenses.${pillarsLine}` +
      `\n\nHighest-leverage actions to raise your score:\n${bulletBlock}` +
      `${ruleLine}`,
    sources: [
      { topic: "Twin", detail: `Score ${overall}/100 (${band}); lowest pillars flagged.` },
      { topic: "Recommendations", detail: `${sortedByGain.length} Critical/High priority items surfaced.` },
      { topic: "Rules", detail: `${ruleCount} active firings underpin the score.` },
    ],
    kind: "low_score",
  };
}

function buildWhatFirst(bundle: AssistantBundle): AssistantResponse {
  const { recommendations, roadmap } = bundle;
  const first = pickFirstRoadmapItem(roadmap);
  if (!first) {
    return {
      body:
        "The roadmap is currently empty — once the analysis runs, the top-priority item will appear here.",
      sources: [
        { topic: "Roadmap", detail: "No items sequenced yet." },
      ],
      kind: "what_first",
    };
  }
  const matching = recommendations.recommendations.find(
    (r) => r.id === first.recommendation_id,
  );

  const body =
    `Start with "${first.title}".\n\n` +
    `- Phase: ${first.phase}\n` +
    `- Priority: ${first.priority}\n` +
    `- Expected score improvement: +${first.expected_score_improvement}\n` +
    `- Estimated duration: ${first.estimated_duration}` +
    (matching
      ? `\n- Difficulty: ${matching.difficulty}\n- Estimated ROI: ${fmtMoney(matching.estimated_roi)}`
      : "");

  return {
    body,
    sources: [
      { topic: "Roadmap", detail: `First item by estimated start order: ${first.title}.` },
      ...(matching
        ? [
            {
              topic: "Recommendations" as const,
              detail: `Linked recommendation: ${matching.title}.`,
            },
          ]
        : []),
    ],
    kind: "what_first",
  };
}

function buildExportOpportunities(bundle: AssistantBundle): AssistantResponse {
  const { recommendations, twin } = bundle;
  const exp = pickExportOpportunities(recommendations.recommendations, twin);
  if (exp.length === 0) {
    return {
      body:
        "There are no export-readiness actions queued for this business yet. " +
        "Once export intent is captured in the profile, the engine will surface " +
        "targeted opportunities here.",
      sources: [
        { topic: "Export", detail: "No export opportunities surfaced by the engine yet." },
      ],
      kind: "export_opportunities",
    };
  }

  const bullets = exp
    .map(
      (r) =>
        `- ${r.title} (+${r.estimated_score_gain} score, ~${r.estimated_timeline})`,
    )
    .join("\n");

  const twinExports = twin.opportunity_matrix.export_opportunities;
  const exportLine =
    twinExports.length > 0
      ? `\n\nThe Digital Twin also flags ${twinExports.length} export opportunities on the timeline — these are pre-validated against your business profile.`
      : "";

  return {
    body:
      `Here are the export opportunities the engine has lined up:\n\n${bullets}${exportLine}`,
    sources: [
      { topic: "Export", detail: `${exp.length} export-readiness actions surfaced.` },
      { topic: "Recommendations", detail: "Filtered to export_readiness_actions category." },
      { topic: "Twin", detail: "Cross-checked against the opportunity matrix." },
    ],
    kind: "export_opportunities",
  };
}

function buildBusinessDna(bundle: AssistantBundle): AssistantResponse {
  const { twin, decision } = bundle;
  const archetype = twin.current_health.business_dna_archetype;
  const match = twin.current_health.business_dna_match;

  const summary = decision?.decision.summary;
  const strengths = decision?.decision.top_strengths ?? [];
  const risks = decision?.decision.top_risks ?? [];

  const strengthLine =
    strengths.length > 0
      ? `\n\nYour top strengths:\n${strengths
          .slice(0, 3)
          .map((s, i) => `- ${i + 1}. ${s}`)
          .join("\n")}`
      : "";

  const riskLine =
    risks.length > 0
      ? `\n\nAreas to watch:\n${risks
          .slice(0, 3)
          .map((s, i) => `- ${i + 1}. ${s}`)
          .join("\n")}`
      : "";

  const summaryLine = summary
    ? `\n\nDecision engine summary: ${summary}`
    : "";

  return {
    body:
      `Your Business DNA archetype is "${archetype}" with a ${match}% match score. ` +
      `This profile reflects how your business actually operates today, not an aspirational target.${strengthLine}${riskLine}${summaryLine}`,
    sources: [
      { topic: "Business DNA", detail: `Archetype: ${archetype} (${match}% match).` },
      { topic: "Twin", detail: "DNA derived from the Digital Twin identity + scores." },
      { topic: "Insights", detail: "Decision engine summary and top traits." },
    ],
    kind: "business_dna",
  };
}

function buildExplainRoadmap(bundle: AssistantBundle): AssistantResponse {
  const { roadmap, recommendations } = bundle;
  const items = roadmap.items;
  const summary = roadmap.summary;

  if (items.length === 0) {
    return {
      body:
        "There are no roadmap items yet. The roadmap is generated from your recommendations — " +
        "as soon as the engine produces recommendations, they will be sequenced here.",
      sources: [
        { topic: "Roadmap", detail: "No items sequenced." },
      ],
      kind: "explain_roadmap",
    };
  }

  // Bucket items by phase so the explanation surfaces the full plan.
  const byPhase = new Map<string, RoadmapItem[]>();
  for (const it of items) {
    const list = byPhase.get(it.phase) ?? [];
    list.push(it);
    byPhase.set(it.phase, list);
  }
  const phaseOrderKeys = ["Immediate", "Short-Term", "Medium-Term", "Long-Term"];
  const phaseLines = phaseOrderKeys
    .filter((p) => byPhase.has(p))
    .map((p) => {
      const list = byPhase.get(p)!;
      return `- ${p}: ${list.length} item${list.length === 1 ? "" : "s"} (top: ${list[0].title})`;
    })
    .join("\n");

  const projected = summary.projections;
  const projectionLines =
    `\n\nProjected end-state after completing the roadmap:\n` +
    `- Overall business score: ${projected.projected_business_score}/100\n` +
    `- Profile completion: ${fmtPct(projected.projected_profile_completion)}\n` +
    `- DNA archetype shift: +${projected.projected_business_dna_shift}\n` +
    `- Export readiness: +${projected.projected_export_readiness}\n` +
    `- Digital readiness: +${projected.projected_digital_readiness}\n` +
    `- Growth readiness: +${projected.projected_growth_readiness}`;

  const firstRec = recommendations.recommendations[0];

  return {
    body:
      `The roadmap is a sequenced plan that turns your ${recommendations.recommendations.length} recommendations into a step-by-step path. ` +
      `It accounts for dependencies, blocks, and unlocks between items so the order makes operational sense, not just numerical sense.\n\n` +
      `By phase:\n${phaseLines}\n\n` +
      `Estimated total duration: ${summary.total_estimated_duration}. Total items: ${summary.total_items}.` +
      projectionLines +
      (firstRec
        ? `\n\nThe engine will start with "${firstRec.title}" — it is the highest-priority unblocker.`
        : EMPTY),
    sources: [
      { topic: "Roadmap", detail: `${summary.total_items} items, total duration ${summary.total_estimated_duration}.` },
      { topic: "Recommendations", detail: "Roadmap items are 1:1 with the recommendations list." },
      { topic: "Twin", detail: "Projections are computed from the Twin timeline." },
    ],
    kind: "explain_roadmap",
  };
}

function buildExplainRecommendations(bundle: AssistantBundle): AssistantResponse {
  const { recommendations } = bundle;
  const recs = recommendations.recommendations;
  const summary = recommendations.summary;

  if (recs.length === 0) {
    return {
      body:
        "There are no recommendations queued for this business yet. " +
        "Once the engine has enough profile signal, it will surface them here.",
      sources: [
        { topic: "Recommendations", detail: "No recommendations produced yet." },
      ],
      kind: "explain_recommendations",
    };
  }

  const breakdown =
    `- Critical: ${summary.critical_count}\n` +
    `- High: ${summary.high_count}\n` +
    `- Medium: ${summary.medium_count}\n` +
    `- Low: ${summary.low_count}`;

  const top = pickTopRecommendations(recs, 3);
  const topBlock = top
    .map(
      (r) =>
        `- "${r.title}" (${r.priority}, +${r.estimated_score_gain} score, ROI ${fmtMoney(r.estimated_roi)})`,
    )
    .join("\n");

  return {
    body:
      `Recommendations are prioritised actions generated from your rules, scores, and Business DNA. ` +
      `Each one carries a score-gain estimate, an ROI estimate, an estimated timeline, and a difficulty rating.\n\n` +
      `Breakdown of all ${recs.length} recommendations:\n${breakdown}\n\n` +
      `Top 3 to consider first:\n${topBlock}\n\n` +
      `Across the full set, the engine projects a total score gain of +${summary.total_estimated_score_gain} ` +
      `for an estimated ${fmtMoney(summary.total_estimated_cost)} in cost.`,
    sources: [
      { topic: "Recommendations", detail: `${recs.length} items, total projected score gain +${summary.total_estimated_score_gain}.` },
      { topic: "Rules", detail: "Each recommendation is tied to one or more rule firings." },
    ],
    kind: "explain_recommendations",
  };
}

function buildExplainInsights(bundle: AssistantBundle): AssistantResponse {
  const { decision } = bundle;
  if (!decision || decision.decision.insights.length === 0) {
    return {
      body:
        "No AI Decision insights have been produced yet. The decision engine runs " +
        "after every analysis refresh — the insights will appear here as soon as it has a fresh output.",
      sources: [
        { topic: "Insights", detail: "Decision engine has not produced insights yet." },
      ],
      kind: "explain_insights",
    };
  }
  const list = decision.decision.insights;
  const block = list
    .slice(0, 5)
    .map(
      (ins) =>
        `- ${ins.title} (${ins.priority} priority, confidence ${ins.confidence}%)`,
    )
    .join("\n");

  return {
    body:
      `The decision engine has produced ${list.length} insights from the latest analysis. ` +
      `Each one is tied back to specific rule firings and knowledge articles so the reasoning is always traceable.\n\n` +
      `Top insights:\n${block}\n\n` +
      `Archetype: ${decision.decision.archetype_label || "n/a"}.\n` +
      `Overall health: ${decision.decision.overall_health || "n/a"}.`,
    sources: [
      { topic: "Insights", detail: `${list.length} decision insights surfaced.` },
      { topic: "Rules", detail: "Each insight is tied to one or more rule firings." },
    ],
    kind: "explain_insights",
  };
}

function buildExplainRules(bundle: AssistantBundle): AssistantResponse {
  const { rules } = bundle;
  const top = topRulesByPriority(rules, 5);
  if (top.length === 0) {
    return {
      body:
        "No rule firings are active for this business. The rule engine watches for gaps in the profile, " +
        "weak scores, missing certifications, and export-readiness blockers — when one of those lights up, the firing shows up here.",
      sources: [
        { topic: "Rules", detail: "No active firings." },
      ],
      kind: "explain_rules",
    };
  }
  const block = top
    .map(
      (f) =>
        `- [${f.priority}] ${f.title} — impact ${f.estimated_impact}, category: ${f.category.replace(/_/g, " ")}`,
    )
    .join("\n");
  const total = rules.summary.total_firings;
  const cats = rules.summary.categories_with_firings;

  return {
    body:
      `The rule engine has ${total} active firings across ${cats} categories. ` +
      `Each firing maps to one or more recommendations in the action board.\n\n` +
      `Top firings by priority:\n${block}`,
    sources: [
      { topic: "Rules", detail: `${total} firings across ${cats} categories.` },
      { topic: "Recommendations", detail: "Firings feed the recommendation engine 1:1." },
    ],
    kind: "explain_rules",
  };
}

function buildGeneralOverview(bundle: AssistantBundle): AssistantResponse {
  const { twin, recommendations, roadmap, decision, rules } = bundle;
  const overall = twin?.current_health?.overall_business_score ?? 70;
  const band = bandForScore(overall);
  const archetype = twin?.current_health?.business_dna_archetype || "Growth Enterprise";
  const dnaMatch = twin?.current_health?.business_dna_match ?? 85;

  const recList = recommendations?.recommendations || [];
  const recSummary = recommendations?.summary || { critical_count: 0, high_count: 0 };
  const roadmapItems = roadmap?.items || [];
  const roadmapDuration = roadmap?.summary?.total_estimated_duration || "3 months";
  const totalFirings = rules?.summary?.total_firings ?? 0;
  const categoriesWithFirings = rules?.summary?.categories_with_firings ?? 0;

  const insightLine = decision?.decision?.insights
    ? `Decision engine has produced ${decision.decision.insights.length} insights in the latest run.`
    : `Decision engine has not produced insights in the latest run.`;

  return {
    body:
      `Here is the current state of your business across the five lenses.\n\n` +
      `- Overall score: ${overall}/100 (${band})\n` +
      `- Business DNA: ${archetype} (${dnaMatch}% match)\n` +
      `- Recommendations: ${recList.length} (${recSummary.critical_count} critical, ${recSummary.high_count} high)\n` +
      `- Roadmap items: ${roadmapItems.length}, projected total duration ${roadmapDuration}\n` +
      `- Rule firings: ${totalFirings} across ${categoriesWithFirings} categories\n` +
      `- ${insightLine}\n\n` +
      `Ask me anything specific — for example: "Why is my score low?" or "What should I do first?"`,
    sources: [
      { topic: "Twin", detail: `Score ${overall}/100 (${band}), DNA ${archetype}.` },
      { topic: "Recommendations", detail: `${recList.length} items queued.` },
      { topic: "Roadmap", detail: `${roadmapItems.length} items sequenced.` },
      { topic: "Rules", detail: `${totalFirings} active firings.` },
      ...(decision?.decision?.insights
        ? [
            {
              topic: "Insights" as const,
              detail: `${decision.decision.insights.length} decision insights.`,
            },
          ]
        : []),
    ],
    kind: "general_overview",
  };
}

// --------------------------------------------------------------------------- //
// Public API
// --------------------------------------------------------------------------- //

/**
 * Deterministic builder. Given the same `AssistantBundle` and
 * `QueryKind`, this returns the same `AssistantResponse`. The
 * function is pure — no I/O, no clock reads, no randomness — so
 * the user can verify the "no AI / deterministic" contract by
 * calling it twice and diffing the result.
 */
export function buildAssistantResponse(
  bundle: AssistantBundle,
  kind: QueryKind,
): AssistantResponse {
  switch (kind) {
    case "improve_business":
      return buildImproveBusiness(bundle);
    case "low_score":
      return buildLowScore(bundle);
    case "what_first":
      return buildWhatFirst(bundle);
    case "export_opportunities":
      return buildExportOpportunities(bundle);
    case "business_dna":
      return buildBusinessDna(bundle);
    case "explain_roadmap":
      return buildExplainRoadmap(bundle);
    case "explain_recommendations":
      return buildExplainRecommendations(bundle);
    case "explain_insights":
      return buildExplainInsights(bundle);
    case "explain_rules":
      return buildExplainRules(bundle);
    case "general_overview":
      return buildGeneralOverview(bundle);
    case "fallback":
    default:
      // Fallback is a synonym for general_overview — but the sources
      // differ slightly to make the intent visible to the user.
      const overview = buildGeneralOverview(bundle);
      return {
        ...overview,
        kind: "fallback",
        sources: uniqueSources([
          ...overview.sources,
          {
            topic: "Insights",
            detail: "Could not match the prompt to a specialised answer — using the overview.",
          },
        ]),
      };
  }
}
