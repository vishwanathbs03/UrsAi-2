"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/assistant/context-snapshot.ts
var context_snapshot_exports = {};
__export(context_snapshot_exports, {
  buildBusinessSnapshot: () => buildBusinessSnapshot,
  composeGreeting: () => composeGreeting
});
module.exports = __toCommonJS(context_snapshot_exports);
function bandFromRevenue(revenue) {
  if (!Number.isFinite(revenue) || revenue <= 0) {
    return {
      label: "Pre-revenue",
      range: { min: 0, max: 0, currency: "INR" },
      index: 5
    };
  }
  if (revenue < 1e6) {
    return {
      label: "Micro (<\u20B910L)",
      range: { min: 0, max: 999999, currency: "INR" },
      index: 15
    };
  }
  if (revenue < 2e7) {
    return {
      label: "Small (\u20B910L\u2013\u20B92Cr)",
      range: { min: 1e6, max: 19999999, currency: "INR" },
      index: 35
    };
  }
  if (revenue < 1e8) {
    return {
      label: "Medium (\u20B92Cr\u2013\u20B910Cr)",
      range: { min: 2e7, max: 99999999, currency: "INR" },
      index: 65
    };
  }
  return {
    label: "Large (\u20B910Cr+)",
    range: { min: 1e8, max: Number.MAX_SAFE_INTEGER, currency: "INR" },
    index: 90
  };
}
function bandForScore(score) {
  if (score >= 75) return "Leading";
  if (score >= 50) return "Established";
  if (score >= 25) return "Developing";
  return "Foundation";
}
function buildBusinessSnapshot(bundle) {
  const twin = bundle.twin;
  const recs = bundle.recommendations;
  const roadmap = bundle.roadmap;
  const rules = bundle.rules;
  const revenue = Number(twin.identity.annual_revenue ?? 0);
  const revenueBand = bandFromRevenue(revenue);
  const id = twin.identity;
  const profile = twin.profile;
  const ch = twin.current_health;
  const healthScore = ch.overall_business_score;
  const healthBand = bandForScore(healthScore);
  const projectedScore = Math.round(twin.timeline.twelve_month.projected_overall_score);
  const activeRisks = twin.risk_matrix.critical_risks.length + twin.risk_matrix.high_risks.length + twin.risk_matrix.medium_risks.length;
  const opportunityBuckets = [
    twin.opportunity_matrix.quick_wins.length,
    twin.opportunity_matrix.strategic_investments.length,
    twin.opportunity_matrix.long_term_growth.length,
    twin.opportunity_matrix.export_opportunities.length,
    twin.opportunity_matrix.digital_opportunities.length,
    twin.opportunity_matrix.funding_opportunities.length
  ].reduce((acc, n) => acc + n, 0);
  const topRecommendations = [...recs.recommendations].sort((a, b) => {
    const pW = priorityWeight(a.priority) - priorityWeight(b.priority);
    if (pW !== 0) return pW;
    return b.estimated_score_gain - a.estimated_score_gain;
  }).slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    category: humanizeCategory(r.category),
    priority: r.priority,
    estimatedScoreGain: Math.round(r.estimated_score_gain || 0),
    estimatedRoi: Math.round(r.estimated_roi || 0),
    estimatedTimeline: r.estimated_timeline,
    difficulty: r.difficulty
  }));
  const profileParagraph = composeProfile({
    legalName: id.legal_name || "your business",
    industry: id.industry || "your sector",
    revenueBand,
    employeeCount: id.employee_count,
    healthBand,
    healthScore,
    dnaMatch: ch.business_dna_match,
    archetype: ch.business_dna_archetype
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
    profileParagraph
  };
}
function priorityWeight(p) {
  if (p === "Critical") return 0;
  if (p === "High") return 1;
  if (p === "Medium") return 2;
  return 3;
}
function humanizeCategory(category) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function composeProfile(args) {
  return [
    `You operate ${args.legalName} in ${args.industry} as a ${args.revenueBand.label.toLowerCase()} enterprise with ${args.employeeCount} employees.`,
    `Your Digital Twin reports an overall business score of ${args.healthScore}/100 (${args.healthBand}).`,
    `Your Business DNA archetype "${args.archetype}" matches at ${args.dnaMatch}% \u2014 everything I suggest below is calibrated to this profile.`
  ].join(" ");
}
function composeGreeting(snapshot, hour) {
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Hello";
  return `${greet} \u2014 looking at ${snapshot.legalName}'s profile (${snapshot.healthScore}/100, ${snapshot.healthBand} band).`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildBusinessSnapshot,
  composeGreeting
});
