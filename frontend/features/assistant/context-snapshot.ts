/**
 * Business context snapshot — Sprint H4 (Intelligence Layer).
 *
 * The assistant never asks the user to repeat themselves. This
 * module derives a single, compact "what does the consultant
 * know about you right now" view from the upstream payloads.
 *
 * Every section of the consultant orchestrator and every
 * follow-up generator reads from this snapshot — never from the
 * raw payloads — so the wording stays consistent across replies.
 *
 * Pure function. No I/O, no clock reads. The same bundle
 * always yields the same snapshot.
 */

import type {
  RecommendationsResponse,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import type { RulesResponse } from "@/types/dashboard";
import type { AssistantBundle } from "./builder";

export interface RevenueBand {
  /** Compact label, e.g. "Micro (<₹10L)", "Small (₹10L–₹2Cr)", "Medium (₹2Cr–₹10Cr)". */
  label: string;
  /** Numeric raw range for screens that need the value. */
  range: { min: number; max: number; currency: string };
  /** Position along the small-business spectrum (0..100, deterministic). */
  index: number;
}

export interface BusinessSnapshot {
  legalName: string;
  industry: string;
  employeeCount: number;
  annualRevenue: number;
  revenueBand: RevenueBand;
  establishedYear: number | null;
  hasWebsite: boolean;
  hasEcommerce: boolean;
  hasIEC: boolean;
  usesDigitalMarketing: boolean;
  productsCount: number;
  certificationsCount: number;
  healthScore: number;
  healthBand: "Leading" | "Established" | "Developing" | "Foundation";
  dnaArchetype: string;
  dnaMatch: number;
  rulesFiring: number;
  recommendationCount: number;
  criticalRecommendations: number;
  highRecommendations: number;
  roadmapTotalItems: number;
  roadmapCompletionPct: number;
  projectedScore: number;
  activeRisks: number;
  opportunityBuckets: number;
  estimatedScoreGain: number;
  estimatedRoi: number;
  topRecommendations: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    estimatedScoreGain: number;
    estimatedRoi: number;
    estimatedTimeline: string;
    difficulty: string;
  }>;
  /** A one-paragraph "consultant knows you" summary. */
  profileParagraph: string;
}

/** Stable Indian-rupee revenue bands for the MSME sector. */
function bandFromRevenue(revenue: number): RevenueBand {
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return {
      label: "Pre-revenue",
      range: { min: 0, max: 0, currency: "INR" },
      index: 5,
    };
  }
  if (revenue < 1_000_000) {
    return {
      label: "Micro (<₹10L)",
      range: { min: 0, max: 999_999, currency: "INR" },
      index: 15,
    };
  }
  if (revenue < 20_000_000) {
    return {
      label: "Small (₹10L–₹2Cr)",
      range: { min: 1_000_000, max: 19_999_999, currency: "INR" },
      index: 35,
    };
  }
  if (revenue < 100_000_000) {
    return {
      label: "Medium (₹2Cr–₹10Cr)",
      range: { min: 20_000_000, max: 99_999_999, currency: "INR" },
      index: 65,
    };
  }
  return {
    label: "Large (₹10Cr+)",
    range: { min: 100_000_000, max: Number.MAX_SAFE_INTEGER, currency: "INR" },
    index: 90,
  };
}

function bandForScore(score: number): BusinessSnapshot["healthBand"] {
  if (score >= 75) return "Leading";
  if (score >= 50) return "Established";
  if (score >= 25) return "Developing";
  return "Foundation";
}

/**
 * Build the snapshot. Pure function. Same bundle => same snapshot.
 */
export function buildBusinessSnapshot(bundle: AssistantBundle): BusinessSnapshot {
  const twin = bundle.twin as TwinResponse;
  const recs = bundle.recommendations as RecommendationsResponse;
  const roadmap = bundle.roadmap as RoadmapResponse;
  const rules = bundle.rules as RulesResponse;

  const revenue = Number(twin.identity.annual_revenue ?? 0);
  const revenueBand = bandFromRevenue(revenue);

  const id = twin.identity;
  const profile = twin.profile;
  const ch = twin.current_health;
  const healthScore = ch.overall_business_score;
  const healthBand = bandForScore(healthScore);

  const projectedScore = Math.round(twin.timeline.twelve_month.projected_overall_score);

  const activeRisks =
    twin.risk_matrix.critical_risks.length +
    twin.risk_matrix.high_risks.length +
    twin.risk_matrix.medium_risks.length;

  const opportunityBuckets = [
    twin.opportunity_matrix.quick_wins.length,
    twin.opportunity_matrix.strategic_investments.length,
    twin.opportunity_matrix.long_term_growth.length,
    twin.opportunity_matrix.export_opportunities.length,
    twin.opportunity_matrix.digital_opportunities.length,
    twin.opportunity_matrix.funding_opportunities.length,
  ].reduce((acc, n) => acc + n, 0);

  const topRecommendations = [...recs.recommendations]
    .sort((a, b) => {
      const pW = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (pW !== 0) return pW;
      return b.estimated_score_gain - a.estimated_score_gain;
    })
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: humanizeCategory(r.category),
      priority: r.priority,
      estimatedScoreGain: Math.round(r.estimated_score_gain || 0),
      estimatedRoi: Math.round(r.estimated_roi || 0),
      estimatedTimeline: r.estimated_timeline,
      difficulty: r.difficulty,
    }));

  const profileParagraph = composeProfile({
    legalName: id.legal_name || "your business",
    industry: id.industry || "your sector",
    revenueBand,
    employeeCount: id.employee_count,
    healthBand,
    healthScore,
    dnaMatch: ch.business_dna_match,
    archetype: ch.business_dna_archetype,
  });

  return {
    legalName: id.legal_name,
    industry: id.industry,
    employeeCount: id.employee_count || 0,
    annualRevenue: revenue,
    revenueBand,
    establishedYear: id.established_year || null,
    hasWebsite: !!profile.has_website,
    hasEcommerce: !!profile.has_ecommerce,
    hasIEC: !!profile.has_iec_number,
    usesDigitalMarketing: !!profile.uses_digital_marketing,
    productsCount: profile.products_count,
    certificationsCount: profile.certifications_count || 0,
    healthScore: Math.round(healthScore),
    healthBand,
    dnaArchetype: ch.business_dna_archetype || "Growth Enterprise",
    dnaMatch: Math.round(ch.business_dna_match || 0),
    rulesFiring: rules.summary.total_firings,
    recommendationCount: recs.recommendations.length,
    criticalRecommendations: recs.summary.critical_count,
    highRecommendations: recs.summary.high_count,
    roadmapTotalItems: roadmap.items.length,
    roadmapCompletionPct: Math.round(twin.timeline.twelve_month.roadmap_completion_pct),
    projectedScore,
    activeRisks,
    opportunityBuckets,
    estimatedScoreGain: Math.round(twin.growth_potential.total_expected_score_gain),
    estimatedRoi: Math.round(twin.growth_potential.total_expected_roi),
    topRecommendations,
    profileParagraph,
  };
}

function priorityWeight(p: string): number {
  if (p === "Critical") return 0;
  if (p === "High") return 1;
  if (p === "Medium") return 2;
  return 3;
}

function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function composeProfile(args: {
  legalName: string;
  industry: string;
  revenueBand: RevenueBand;
  employeeCount: number;
  healthBand: string;
  healthScore: number;
  dnaMatch: number;
  archetype: string;
}): string {
  return [
    `You operate ${args.legalName} in ${args.industry} as a ${args.revenueBand.label.toLowerCase()} enterprise with ${args.employeeCount} employees.`,
    `Your Digital Twin reports an overall business score of ${args.healthScore}/100 (${args.healthBand}).`,
    `Your Business DNA archetype "${args.archetype}" matches at ${args.dnaMatch}% — everything I suggest below is calibrated to this profile.`,
  ].join(" ");
}

/**
 * Compose a one-line greeting that references the live context.
 * Pure function of the snapshot.
 */
export function composeGreeting(snapshot: BusinessSnapshot, hour: number): string {
  const greet =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Hello";
  return `${greet} — looking at ${snapshot.legalName}'s profile (${snapshot.healthScore}/100, ${snapshot.healthBand} band).`;
}
