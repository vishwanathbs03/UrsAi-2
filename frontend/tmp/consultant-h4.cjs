"use strict";
"use client";
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

// features/assistant/consultant.ts
var consultant_exports = {};
__export(consultant_exports, {
  buildConsultantResponse: () => buildConsultantResponse,
  formatRoi: () => formatRoi,
  formatScoreGain: () => formatScoreGain
});
module.exports = __toCommonJS(consultant_exports);

// features/assistant/format-numbers.ts
function formatScoreGain(value) {
  if (value === null || value === void 0 || Number.isNaN(value)) {
    return "\u2014";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)} pts`;
}
function formatRoi(value) {
  if (value === null || value === void 0 || Number.isNaN(value)) {
    return "\u2014";
  }
  const abs = Math.abs(value);
  let scaled = value;
  let suffix = "";
  if (abs >= 1e7) {
    scaled = value / 1e7;
    suffix = " Cr";
  } else if (abs >= 1e5) {
    scaled = value / 1e5;
    suffix = " L";
  } else if (abs >= 1e3) {
    scaled = value / 1e3;
    suffix = "k";
  }
  const fixed = abs >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `\u20B9${fixed}${suffix}`;
}

// features/assistant/context-snapshot.ts
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

// features/assistant/consultant.ts
function buildConsultantResponse(options) {
  const { bundle, prompt, kind } = options;
  const snapshot = buildBusinessSnapshot(bundle);
  const route = ROUTES[kind] ?? ROUTES.fallback;
  const sections = [];
  sections.push(route.summary(bundle, snapshot, prompt));
  route.compose(bundle, snapshot, sections, prompt);
  sections.sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key)
  );
  const sources = resolveSources(route.sources, bundle, snapshot);
  const body = renderPlainText(sections, snapshot);
  const greeting = composeGreeting(
    snapshot,
    (/* @__PURE__ */ new Date()).getHours()
  );
  return {
    greeting,
    topic: options.topic ?? route.topic,
    sources,
    sections,
    body,
    kind
  };
}
var SECTION_ORDER = [
  "summary",
  "findings",
  "recommendations",
  "impact",
  "action_plan",
  "next_questions",
  "decision"
];
function resolveSources(source, bundle, snapshot) {
  if (typeof source === "function") {
    return source(bundle, snapshot);
  }
  return source;
}
var ROUTES = {
  improve_business: {
    topic: "Improve my business",
    summary: improveSummary,
    compose: composeImprove,
    sources: improveSources
  },
  low_score: {
    topic: "Why is my score low",
    summary: lowScoreSummary,
    compose: composeLowScore,
    sources: lowScoreSources
  },
  growth_strategy: {
    topic: "Business growth",
    summary: growthSummary,
    compose: composeGrowth,
    sources: growthSources
  },
  digital_transformation: {
    topic: "Digital transformation",
    summary: digitalSummary,
    compose: composeDigital,
    sources: digitalSources
  },
  finance: {
    topic: "Finance",
    summary: financeSummary,
    compose: composeFinance,
    sources: financeSources
  },
  gst: {
    topic: "GST",
    summary: gstSummary,
    compose: composeGst,
    sources: commonSources(["Twin", "Compliance"])
  },
  government_schemes: {
    topic: "Government schemes",
    summary: schemesSummary,
    compose: composeSchemes,
    sources: commonSources(["Twin", "Government Schemes"])
  },
  marketing: {
    topic: "Marketing",
    summary: marketingSummary,
    compose: composeMarketing,
    sources: commonSources(["Twin", "Marketing"])
  },
  operations: {
    topic: "Operations",
    summary: operationsSummary,
    compose: composeOperations,
    sources: commonSources(["Twin", "Roadmap"])
  },
  hiring: {
    topic: "Hiring",
    summary: hiringSummary,
    compose: composeHiring,
    sources: commonSources(["Twin", "Recommendations"])
  },
  compliance: {
    topic: "Compliance",
    summary: complianceSummary,
    compose: composeCompliance,
    sources: commonSources(["Twin", "Rules"])
  },
  risk: {
    topic: "Risk",
    summary: riskSummary,
    compose: composeRisk,
    sources: commonSources(["Twin", "Rules"])
  },
  scaling: {
    topic: "Scaling",
    summary: scalingSummary,
    compose: composeScaling,
    sources: commonSources(["Twin", "Recommendations"])
  },
  what_first: {
    topic: "What should I do first",
    summary: whatFirstSummary,
    compose: composeWhatFirst,
    sources: commonSources(["Twin", "Roadmap"])
  },
  export_opportunities: {
    topic: "Export opportunities",
    summary: exportSummary,
    compose: composeExport,
    sources: commonSources(["Twin", "Export"])
  },
  business_dna: {
    topic: "Business DNA",
    summary: dnaSummary,
    compose: composeDna,
    sources: commonSources(["Twin", "Business DNA"])
  },
  explain_roadmap: {
    topic: "Roadmap",
    summary: roadmapSummary,
    compose: composeRoadmap,
    sources: commonSources(["Twin", "Roadmap"])
  },
  explain_recommendations: {
    topic: "Recommendations",
    summary: recommendationsSummary,
    compose: composeRecommendations,
    sources: commonSources(["Twin", "Recommendations"])
  },
  explain_insights: {
    topic: "Insights",
    summary: insightsSummary,
    compose: composeInsights,
    sources: commonSources(["Twin", "Insights"])
  },
  explain_rules: {
    topic: "Rules",
    summary: rulesSummaryFn,
    compose: composeRulesFn,
    sources: commonSources(["Twin", "Rules"])
  },
  general_overview: {
    topic: "Overview",
    summary: overviewSummary,
    compose: composeOverview,
    sources: overviewSources
  },
  decision_hire: {
    topic: "Should I Hire?",
    summary: decisionHireSummary,
    compose: composeDecisionHire,
    sources: commonSources(["Twin", "Recommendations"])
  },
  decision_expand: {
    topic: "Should I Expand?",
    summary: decisionExpandSummary,
    compose: composeDecisionExpand,
    sources: commonSources(["Twin", "Roadmap"])
  },
  decision_loan: {
    topic: "Should I apply for a Loan?",
    summary: decisionLoanSummary,
    compose: composeDecisionLoan,
    sources: commonSources(["Twin", "Recommendations"])
  },
  action_plan: {
    topic: "Action plan",
    summary: actionPlanSummary,
    compose: composeActionPlan,
    sources: commonSources(["Twin", "Roadmap"])
  },
  fallback: {
    topic: "General",
    summary: fallbackSummary,
    compose: composeFallback,
    sources: overviewSources
  }
};
function section(key, title, partial = {}) {
  return { key, title, ...partial };
}
function findings(items, title = "What I found", caption) {
  return section("findings", title, { bullets: items, caption });
}
function recommendations(items, title = "What you should do", caption) {
  return section("recommendations", title, { bullets: items, caption });
}
function impactLines(lines, title = "Estimated impact") {
  return section("impact", title, { lines });
}
function nextQuestionsLabels(list) {
  return section(
    "next_questions",
    "Next questions to ask",
    {
      bullets: (list ?? []).map((q) => ({
        id: q.id,
        title: q.label
      })),
      caption: "Tap any of these to keep the conversation moving \u2014 they route through the consultant automatically."
    }
  );
}
function impactFromSnapshot(snapshot) {
  return impactLines(
    [
      `+${snapshot.estimatedScoreGain} pts expected if you execute the priority list end-to-end.`,
      `~${snapshot.estimatedRoi}% modelled ROI across the recommendations.`,
      `12-month projected score: ${snapshot.projectedScore}/100 vs current ${snapshot.healthScore}/100.`
    ],
    "Estimated impact"
  );
}
function actionWeeksFromRecommendation(rec) {
  const base = rec.title;
  const priority = rec.priority;
  const cat = rec.category;
  const digital = cat === "digital_transformation_actions" || /website|web|seo|digital|online|portfolio|app|brand|google|social/i.test(base);
  const exportCat = cat === "export_readiness_actions" || /export|iec|trade|ship|overseas/i.test(base);
  const financeCat = cat === "high_priority" || /loan|gst|tax|funding|scheme|invoice|cash|account/i.test(base);
  const complianceCat = cat === "compliance_actions" || /compliance|registration|licence|permit|legal/i.test(base);
  const title = base;
  if (digital) {
    return [
      {
        week: "Week 1 \u2014 Discover",
        steps: [
          `Audit current digital footprint \u2014 list ${title.toLowerCase()} gaps and baseline channel metrics.`,
          "Confirm target audience and brand positioning (one-page brief).",
          "Lock down a single success metric (e.g. qualified leads / month)."
        ]
      },
      {
        week: "Week 2 \u2014 Build",
        steps: [
          "Stand up the missing asset (e.g. microsite / landing page / Google Business profile).",
          "Wire analytics (GA4 / Plausible) and one conversion event.",
          "Draft a 4-week content calendar aligned to the positioning brief."
        ]
      },
      {
        week: "Week 3 \u2014 Activate",
        steps: [
          "Launch the campaign (paid + organic distribution).",
          "Brief the team on weekly review cadence.",
          `Prioritise: hit the planned milestone for ${rec.estimated_timeline || "this phase"}.`
        ]
      },
      {
        week: "Week 4 \u2014 Optimise",
        steps: [
          "Weekly review: verify the success metric moved by \u2265 10%.",
          "Double down on the top channel; cut the bottom one.",
          "Re-rank recommendations for the following month."
        ]
      }
    ];
  }
  if (exportCat) {
    return [
      {
        week: "Week 1 \u2014 Pre-qualification",
        steps: [
          "Obtain or renew the IEC (Import Export Code) \u2014 prerequisite for any cross-border move.",
          "List the three most likely destination markets based on product fit.",
          "Engage a freight partner for an indicative shipping quote."
        ]
      },
      {
        week: "Week 2 \u2014 Compliance",
        steps: [
          "Reconfirm GST + product-specific HS codes (4\u20138 digits).",
          "Register on the relevant export portal (e.g. ICEGATE / Amazon Global).",
          "Compile the standard document set (IEC, GST, PAN, bank certificate, MOA/AOA)."
        ]
      },
      {
        week: "Week 3 \u2014 First shipment",
        steps: [
          "Ship the first test consignment; verify end-to-end duty flow.",
          "Set payment terms (LC / advance / open credit) and bank reconciliation cadence.",
          "Stand up a 1-page finance dashboard for export revenue."
        ]
      },
      {
        week: "Week 4 \u2014 Scale",
        steps: [
          "Pilot review \u2014 what % of the first batch converted in 30 days?",
          `Decide scale decision: ${priority === "Critical" ? "expand immediately" : "iterate on the pilot"}.`,
          "Refresh the destination shortlist using the new data."
        ]
      }
    ];
  }
  if (complianceCat || financeCat) {
    return [
      {
        week: "Week 1 \u2014 File readiness",
        steps: [
          "Inventory documents: PAN, GST, bank statements, last 12m ITR, registration proofs.",
          `Confirm due date / deadline for ${title}.`,
          "Open tracker \u2014 list every task in priority order."
        ]
      },
      {
        week: "Week 2 \u2014 File paperwork",
        steps: [
          "Submit the application / filing on Day 8 (gives buffer if documents come back).",
          "Pay any fees / stamp duty online; archive the receipt reference.",
          "Notify bank and CA via a single email with the receipt."
        ]
      },
      {
        week: "Week 3 \u2014 Approval / acknowledgement",
        steps: [
          "Track acknowledgement from the relevant authority.",
          "Upload certificates back into the Business Profile.",
          `Rule-engine will now re-grade this recommendation as resolved.`
        ]
      },
      {
        week: "Week 4 \u2014 Risk review",
        steps: [
          `Confirm there is no ${title.toLowerCase()} renewal due in 90 days.`,
          "Lock in a recurring 30-day reminder for compliance re-check.",
          "Re-score: the Business Health meter should rise by next refresh."
        ]
      }
    ];
  }
  return [
    {
      week: "Week 1 \u2014 Set up",
      steps: [
        `Define success: what does "done" look like for ${title}?`,
        "Identify the smallest experiment you can ship this week.",
        "Set up a tracking dashboard (1 metric, 1 cycle)."
      ]
    },
    {
      week: "Week 2 \u2014 Kickoff",
      steps: [
        "Run the experiment; capture one data point per day.",
        `Budget: keep spend below 1% of monthly revenue.`,
        "Daily 5-minute review cadence with the team."
      ]
    },
    {
      week: "Week 3 \u2014 Iterate",
      steps: [
        "Read the metrics; double down on what moved.",
        "Cut anything that didn't shift the needle by 10%.",
        "Compress the action's timeline by 1 week if ahead of plan."
      ]
    },
    {
      week: "Week 4 \u2014 Handover",
      steps: [
        "Document what worked + what didn't.",
        "Promote the best practice into the team playbook.",
        "Schedule the next experiment; refresh the priority list."
      ]
    }
  ];
}
function asBullet(rec) {
  return {
    id: rec.id,
    title: rec.title,
    subtitle: rec.description,
    tone: rec.priority === "Critical" ? "danger" : rec.priority === "High" ? "warn" : rec.priority === "Medium" ? "info" : "violet",
    meta: `${humanizeCategory2(rec.category)} \xB7 ${rec.estimated_timeline}`,
    impact: `+${Math.round(rec.estimated_score_gain || 0)} pts \xB7 ${Math.round(rec.estimated_roi || 0)}% ROI`,
    difficulty: rec.difficulty,
    time: rec.estimated_timeline,
    confidence: Math.round(rec.confidence || 60),
    riskIfIgnored: `Score will stay flat for ${rec.estimated_timeline || "the next quarter"}.`
  };
}
function asBulletFromId(id, recs) {
  const rec = recs.find((r) => r.id === id);
  return rec ? asBullet(rec) : void 0;
}
function bulletsForSnapshot(s, recs) {
  const out = [];
  for (const sr of s.topRecommendations) {
    const bullet = asBulletFromId(sr.id, recs);
    if (bullet) out.push(bullet);
  }
  return out;
}
function humanizeCategory2(category) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function improveSummary(b, s, prompt) {
  const targetScore = Math.max(s.healthScore + s.estimatedScoreGain, s.healthScore);
  return section(
    "summary",
    "Executive Summary",
    {
      caption: `Profile: ${s.legalName} \xB7 ${s.industry} \xB7 ${s.revenueBand.label}`,
      body: [
        `You asked me to "improve your business." Here is the consultant read in one paragraph.`,
        `Your current business score is **${s.healthScore}/100** (${s.healthBand} band). Closing the ${s.criticalRecommendations} critical + ${s.highRecommendations} high-priority recommendations projects you to **~${targetScore}/100** within ${b.roadmap.summary.total_estimated_duration}.`,
        `Total estimated score gain: +${s.estimatedScoreGain} pts. Total expected ROI: ${s.estimatedRoi}%.`
      ].join(" ")
    }
  );
}
function composeImprove(b, s, sections) {
  const top = bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 5);
  sections.push(
    findings(
      [
        {
          id: "im-score",
          title: `Current business score is ${s.healthScore}/100`,
          subtitle: `${s.healthBand} band \u2014 three critical paths to lift it`,
          tone: s.healthScore >= 60 ? "success" : "warn"
        },
        {
          id: "im-rules",
          title: `${s.rulesFiring} active rule firings`,
          subtitle: "Each one is a direct opportunity waiting to be actioned.",
          tone: "info"
        },
        {
          id: "im-dna",
          title: `${s.dnaArchetype} DNA at ${s.dnaMatch}%`,
          subtitle: "Your archetype narrows the effective action list \u2014 we filtered it accordingly.",
          tone: "violet"
        }
      ],
      "Findings"
    )
  );
  if (top.length > 0) {
    sections.push(recommendations(top, "Top 5 priority actions"));
  }
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, top));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.improve_business));
}
function lowScoreSummary(_b, s, _p) {
  const lowest = [...s.topRecommendations].sort((a, b) => b.estimatedScoreGain - a.estimatedScoreGain).slice(0, 1).pop();
  return section(
    "summary",
    "Executive Summary",
    {
      body: [
        `Your score is **${s.healthScore}/100** (${s.healthBand}). The score reflects the gaps the rule engine surfaced after the last analysis \u2014 ${s.rulesFiring} of them are still firing.`,
        lowest ? `The single biggest lift comes from "${lowest.title}" \u2014 currently +${lowest.estimatedScoreGain} pts and ~${lowest.estimatedRoi}% ROI.` : `The single biggest lift comes from your top-ranked recommendation \u2014 see the Findings card for the ranked list.`
      ].join(" ")
    }
  );
}
function composeLowScore(b, s, sections) {
  const lowest = b.twin.scores.scores.filter((sc) => (sc.score ?? 100) < 40).sort((a, b2) => (a.score ?? 100) - (b2.score ?? 100)).slice(0, 5).map((sc) => ({
    id: `lowp-${sc.key}`,
    title: `${sc.title}: ${sc.score}/100`,
    subtitle: sc.explanation,
    tone: "danger"
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
function growthSummary(b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Growth strategy for **${s.legalName}**. We're treating "growth" as a portfolio of three workstreams: (1) revenue expansion via marketing + sales, (2) capability uplift via digital, and (3) capital-readiness via schemes.`,
      `Projected end-state after the priority list completes in ${b.roadmap.summary.total_estimated_duration}: business score ${s.projectedScore}/100 (+${s.estimatedScoreGain} pts) at ~${s.estimatedRoi}% modelled ROI.`
    ].join(" ")
  });
}
function composeGrowth(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "g-mkt",
          title: "Marketing maturity",
          subtitle: s.usesDigitalMarketing ? "Active \u2014 leverage it" : "Quiet \u2014 opportunity to switch on",
          tone: s.usesDigitalMarketing ? "success" : "warn"
        },
        {
          id: "g-product",
          title: `Product surface: ${s.productsCount} SKUs`,
          subtitle: "Determines content cadence and SEO ceiling.",
          tone: "info"
        },
        {
          id: "g-recs",
          title: `${s.recommendationCount} active recommendations`,
          subtitle: `${s.criticalRecommendations} critical, ${s.highRecommendations} high priority.`,
          tone: "violet"
        }
      ],
      "Where growth starts"
    )
  );
  const top = bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 4);
  sections.push(recommendations(top, "Growth moves for this quarter"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, top));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.growth_strategy));
}
function digitalSummary(_b, s, _p) {
  const present = [s.hasWebsite, s.hasEcommerce, s.usesDigitalMarketing].filter(Boolean).length;
  return section("summary", "Executive Summary", {
    body: [
      `Digital transformation read for **${s.legalName}**. Your current digital footprint covers **${present} of 3 core channels** (website / e-commerce / digital marketing).`,
      `Each missing channel has a clean 4-week ramp path \u2014 see the Action Plan card.`
    ].join(" ")
  });
}
function composeDigital(_b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "d-web",
          title: `Website ${s.hasWebsite ? "live" : "missing"}`,
          tone: s.hasWebsite ? "success" : "warn"
        },
        {
          id: "d-ecom",
          title: `E-commerce ${s.hasEcommerce ? "live" : "missing"}`,
          tone: s.hasEcommerce ? "success" : "warn"
        },
        {
          id: "d-mkt",
          title: `Digital marketing ${s.usesDigitalMarketing ? "active" : "off"}`,
          tone: s.usesDigitalMarketing ? "success" : "warn"
        }
      ],
      "Channel audit"
    )
  );
  const ideas = [];
  if (!s.hasWebsite)
    ideas.push(asBulletFor(
      "Launch a corporate website",
      "4-week ramp. Wire analytics on Day 1 and set one conversion event.",
      "warn",
      "+6 pts",
      "Easy",
      "3\u20134 weeks"
    ));
  if (!s.hasEcommerce)
    ideas.push(asBulletFor(
      "Stand up e-commerce / catalogue",
      "Pick the platform aligned with your industry band; integrate payments on Day 7.",
      "info",
      "+5 pts",
      "Moderate",
      "6\u20138 weeks"
    ));
  if (!s.usesDigitalMarketing)
    ideas.push(asBulletFor(
      "Activate digital marketing",
      "Start with paid social on a single channel; commit a 30-day review cadence.",
      "violet",
      "+4 pts",
      "Easy",
      "2 weeks"
    ));
  if (ideas.length === 0) {
    ideas.push(
      asBulletFor(
        "Optimise the funnel you already have",
        "Add retargeting; A/B test the hero copy; reduce checkout friction.",
        "primary",
        "+3 pts",
        "Easy",
        "1 week"
      )
    );
  }
  sections.push(recommendations(ideas, "Digital transformation actions"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(_b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.digital_transformation));
}
function financeSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Finance view for **${s.legalName}** (${s.revenueBand.label} business, ~${s.employeeCount} employees).`,
      `Working capital levers ranked below. We sequenced them so the cheapest money is unlocked first.`
    ].join(" ")
  });
}
function composeFinance(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "f-rev",
          title: `Annual revenue: ${formatRoi(s.annualRevenue)}`,
          subtitle: s.revenueBand.label,
          tone: "info"
        },
        {
          id: "f-up",
          title: "Capital ladder",
          subtitle: "Government schemes \u2192 credit guarantee \u2192 bank loan \u2192 equity",
          tone: "violet"
        },
        {
          id: "f-cred",
          title: "Working-capital posture",
          subtitle: s.healthScore >= 60 ? "Room to expand on credit." : "Tighten receivables first, raise capital second.",
          tone: s.healthScore >= 60 ? "success" : "warn"
        }
      ],
      "Capital position"
    )
  );
  const recs = [
    asBulletFor(
      "PMEGP application (subsidy 15-35%)",
      "First in the capital ladder \u2014 risk-free if the project plan is acceptable.",
      "success",
      "Up to 35% subsidy",
      "Moderate",
      "60\u201390 days"
    ),
    asBulletFor(
      "CGTMSE collateral-free loan",
      "Best for working-capital needs of up to \u20B95Cr without pledging assets.",
      "info",
      "Up to \u20B95 Cr",
      "Moderate",
      "45\u201360 days"
    ),
    asBulletFor(
      "MUDRA (Shishu / Kishore / Tarun)",
      "Quick unsecured loan up to \u20B910L, ideal for inventory + capex small spend.",
      "violet",
      "Up to \u20B910 L",
      "Easy",
      "30 days"
    )
  ];
  sections.push(recommendations(recs, "Capital-ladder options for you"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.finance));
}
function gstSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `**GST** for ${s.legalName}. Below is the consultant walkthrough \u2014 eligibility, deadlines, costs, penalties, and a 4-week ramp for registration if you don't have it yet.`
    ].join(" ")
  });
}
function composeGst(_b, _s, sections) {
  sections.push(
    findings(
      [
        {
          id: "gst-reg",
          title: "Registration threshold (\u20B920L / \u20B940L goods/services)",
          subtitle: "Mandatory if you cross the threshold or sell inter-state.",
          tone: "info"
        },
        {
          id: "gst-deadline",
          title: "Returns: GSTR-1 / 3B monthly or quarterly",
          subtitle: "Pick the quarterly scheme if turnover < \u20B95Cr.",
          tone: "info"
        },
        {
          id: "gst-pen",
          title: "Late-filing penalty",
          subtitle: "\u20B950/day CGST+SGST (\u20B925 each), capped at 0.25% of turnover.",
          tone: "danger"
        }
      ],
      "GST mechanics for an MSME"
    )
  );
  const recs = [
    asBulletFor(
      "File the GST REG-01 application",
      "Required pre-conditions: PAN, Aadhaar of the proprietor, business address proof.",
      "success",
      "One-time",
      "Moderate",
      "7\u201315 days"
    ),
    asBulletFor(
      "Opt into the QRMP scheme (if turnover < \u20B95Cr)",
      "Quarterly return + monthly payment. Saves time + CA cost.",
      "info",
      "Lower compliance load",
      "Easy",
      "1 day to opt in"
    ),
    asBulletFor(
      "Automate invoice \u2192 GSTR-1 \u2192 GSTR-3B with a CA + software stack",
      "Compliance-grade automation + a CA subscription for \u20B91\u20132k/month pays for itself.",
      "violet",
      "Saves 6 hours/month",
      "Easy",
      "2 weeks"
    )
  ];
  sections.push(recommendations(recs, "What I recommend"));
  sections.push(
    impactLines(
      [
        "Avoid \u20B950/day \xD7 N days \xD7 every return you would have missed.",
        "Eligible to claim input tax credit (ITC) on every business purchase.",
        "Opens the door for export-with-IGST refund workflows."
      ],
      "Estimated impact"
    )
  );
  sections.push(actionPlanSection(_b, _s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.gst));
}
function schemesSummary(_b, _s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Government scheme matcher for **${_s.legalName}** (${_s.revenueBand.label}).`,
      `PMEGP, CGTMSE and MUDRA are the three schemes every MSME should hold an opinion on. Below is the eligibility read + the next step for each.`
    ].join(" ")
  });
}
function composeSchemes(b, s, sections) {
  const schemes = b.twin.opportunity_matrix.funding_opportunities;
  sections.push(
    findings(
      [
        {
          id: "sc-match",
          title: `Scheme match across ${schemes.length || "3"} tracked schemes`,
          subtitle: "Computed from your profile depth + revenue band + industry.",
          tone: "info"
        },
        {
          id: "sc-doc",
          title: "Required documents",
          subtitle: "Project report, ID proof, address proof, bank statements, last ITR.",
          tone: "warn"
        },
        {
          id: "sc-channel",
          title: "Apply via your nearest DFO / Bank branch / Udyam portal",
          subtitle: "DIFO offices review; banks co-lend CGTMSE.",
          tone: "violet"
        }
      ],
      "Scheme match"
    )
  );
  const recs = [
    asBulletFor(
      "Apply PMEGP \u2014 subsidy 15-35%",
      "Submit project report + DIPP-30 acknowledgement. Subsidy released on disbursement.",
      "success",
      "Subsidy 15-35%",
      "Moderate",
      "60\u201390 days"
    ),
    asBulletFor(
      "Apply CGTMSE \u2014 collateral-free up to \u20B95Cr",
      "Choose a partner bank; CGTMSE Trust covers 75-85% of the credit risk.",
      "info",
      "Up to \u20B95 Cr",
      "Moderate",
      "45\u201360 days"
    ),
    asBulletFor(
      "Apply MUDRA \u2014 Shishu/Kishore/Tarun",
      "Best for first \u20B950k\u2013\u20B910L of working capital. No collateral required.",
      "violet",
      "Up to \u20B910 L",
      "Easy",
      "30 days"
    )
  ];
  sections.push(recommendations(recs, "Recommend schemes for you"));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.government_schemes));
}
function marketingSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Marketing plan for **${s.legalName}**. We rank the channel mix by customer-acquisition-cost parity \u2014 first-principles, not vibes.`
    ].join(" ")
  });
}
function composeMarketing(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "mk-presence",
          title: `Current presence: ${s.usesDigitalMarketing ? "Yes" : "No"}`,
          tone: s.usesDigitalMarketing ? "success" : "warn"
        },
        {
          id: "mk-product",
          title: `${s.productsCount} product SKUs to market`,
          tone: "info"
        },
        {
          id: "mk-budget",
          title: "Recommended marketing budget",
          subtitle: "7-10% of monthly revenue; tracked weekly.",
          tone: "violet"
        }
      ],
      "Marketing posture"
    )
  );
  const recs = [
    asBulletFor(
      "Run paid social on one channel first",
      "Pick the channel where your audience spends >2 hours/day. Set a 30-day review.",
      "primary",
      "+30% reach",
      "Easy",
      "2 weeks"
    ),
    asBulletFor(
      "Build a 30-day content calendar",
      "Reuse one pillar asset (case study / whitepaper) across every channel.",
      "info",
      "+4 engagement pts",
      "Moderate",
      "1 week"
    ),
    asBulletFor(
      "Set up a referral program",
      "Existing customers convert 3\u20135\xD7 better than cold leads.",
      "violet",
      "+15% retention",
      "Easy",
      "3 weeks"
    )
  ];
  sections.push(recommendations(recs, "Recommended moves"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.marketing));
}
function operationsSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Operations read for **${s.legalName}** (${s.employeeCount} employees, ${s.productsCount} SKUs).`,
      `Below: the three operational moves that unlock the most capacity in the shortest time.`
    ].join(" ")
  });
}
function composeOperations(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "ops-inv",
          title: "Inventory posture",
          subtitle: "Manual or digitised \u2014 drives fill rate + supplier risk.",
          tone: "info"
        },
        {
          id: "ops-people",
          title: "People posture",
          subtitle: `${s.employeeCount} employees \u2014 bandwidth is the constraint or the asset.`,
          tone: "violet"
        },
        {
          id: "ops-flow",
          title: "Operational rhythm",
          subtitle: "Weekly review cadence is the single biggest force-multiplier.",
          tone: "info"
        }
      ],
      "Current state"
    )
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Digitise inventory",
          "Low-cost inventory tool (Zoho / Khatabook / Vyapar) \u2014 wire SKU + supplier + min/max.",
          "success",
          "Fill rate +8%",
          "Easy",
          "2 weeks"
        ),
        asBulletFor(
          "Document SOPs for the top 3 processes",
          "Start with: order-to-cash, procure-to-pay, hire-to-retire.",
          "info",
          "Less fire-fighting",
          "Moderate",
          "3 weeks"
        ),
        asBulletFor(
          "Weekly 30-min ops review (Mon 9am)",
          "Same agenda every week. Locks accountability; lifts the team.",
          "violet",
          "Predictable throughput",
          "Easy",
          "Ongoing"
        )
      ],
      "Recommended moves"
    )
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.operations));
}
function hiringSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Hiring read for **${s.legalName}** \u2014 currently ${s.employeeCount} employees.`,
      `We pin the first-hire decision on operational score (${s.healthScore}/100) + DNA match (${s.dnaMatch}%) + revenue band.`
    ].join(" ")
  });
}
function composeHiring(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "h-cap",
          title: "Capacity gap",
          subtitle: `Expected capacity gap at current growth = ~${Math.max(1, Math.round((100 - s.healthScore) / 10))} FTE.`,
          tone: "warn"
        },
        {
          id: "h-fit",
          title: "First-hire archetype",
          subtitle: "Pick the role that compresses your biggest constraint (sales OR ops OR finance).",
          tone: "info"
        },
        {
          id: "h-cost",
          title: "Affordability check",
          subtitle: s.healthScore >= 60 ? "Score supports the hire." : "Score is borderline \u2014 consider contract-to-hire first.",
          tone: s.healthScore >= 60 ? "success" : "warn"
        }
      ],
      "Should we hire?"
    )
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Hire a sales operator (top priority if revenue < \u20B92Cr)",
          "They bring pipeline + close discipline; payback typically < 4 months.",
          "primary",
          "+12 pts",
          "Moderate",
          "30 days to onboard"
        ),
        asBulletFor(
          "Hire an ops generalist (top priority if 10+ employees)",
          "Stops the founder bottleneck; unlocks 2\xD7 throughput.",
          "info",
          "+8 pts",
          "Moderate",
          "30 days to onboard"
        ),
        asBulletFor(
          "Outsource / fractional CFO (instead of full-time CFO)",
          "Use a fractional CFO for 6 hours/week \u2014 saves \u20B925L/yr vs a full-time hire.",
          "violet",
          "+5 pts",
          "Easy",
          "1 week to onboard"
        )
      ],
      "Role options \u2014 pick the one that fits your constraint"
    )
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.hiring));
}
function complianceSummary(b, s, _p) {
  const ruleCount = b.rules.summary.total_firings;
  return section("summary", "Executive Summary", {
    body: [
      `Compliance read for **${s.legalName}** \u2014 ${ruleCount} active rule firings, ${s.activeRisks} carry risk scores.`,
      `Sorted by deadline. Critical-first.`
    ].join(" ")
  });
}
function composeCompliance(b, s, sections) {
  const ruleBullets = [];
  for (const cat of Object.values(b.rules.categories)) {
    if (!cat || !Array.isArray(cat.firings)) continue;
    for (const f of cat.firings.slice(0, 4)) {
      ruleBullets.push({
        id: f.id,
        title: f.title,
        subtitle: f.description,
        tone: f.priority === "Critical" ? "danger" : f.priority === "High" ? "warn" : "info",
        meta: `${f.priority} \xB7 category ${f.category.replace(/_/g, " ")}`
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
          "Ongoing"
        ),
        asBulletFor(
          "Insurance review",
          "Check if you have adequate fire + product + cyber insurance.",
          "success",
          "Risk transfer",
          "Moderate",
          "2 weeks"
        ),
        asBulletFor(
          "Annual ROC + KYC refresh",
          "Run once every quarter; bundle with your CA's review.",
          "violet",
          "Stays audit-ready",
          "Easy",
          "1 day per quarter"
        )
      ],
      "Compliance moves"
    )
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.compliance));
}
function riskSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Risk register for **${s.legalName}** \u2014 ${s.activeRisks} active risks across critical + high + medium.`,
      `Sorted by impact. Top 3 below.`
    ].join(" ")
  });
}
function composeRisk(b, s, sections) {
  const top = [
    ...b.twin.risk_matrix.critical_risks,
    ...b.twin.risk_matrix.high_risks,
    ...b.twin.risk_matrix.medium_risks
  ].slice(0, 5);
  sections.push(
    findings(
      top.map((r) => ({
        id: r.risk_id,
        title: r.title,
        subtitle: r.description,
        tone: r.priority === "Critical" ? "danger" : r.priority === "High" ? "warn" : "info",
        meta: `${r.priority} \xB7 impact ${r.estimated_impact}`
      })),
      "Active risks"
    )
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Risk register (1 sheet, 1 owner, 1 weekly review)",
          "This is the single highest-leverage move \u2014 discipline beats tools.",
          "primary",
          "Risk culture",
          "Easy",
          "1 week to set up"
        ),
        asBulletFor(
          "Mitigation plan for the top 3 risks",
          "Map: avoiding / transferring / accepting / reducing.",
          "info",
          "-30% residual risk",
          "Moderate",
          "30 days"
        ),
        asBulletFor(
          "Insurance transfer for tail risk",
          "Fire + cyber + product + key-person insurance.",
          "violet",
          "Risk transfer",
          "Moderate",
          "60 days"
        )
      ],
      "Risk mitigation plan"
    )
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.risk));
}
function scalingSummary(b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Scaling strategy for **${s.legalName}**. Three vectors: (1) new geographies, (2) new channels, (3) new SKUs.`,
      `Pick the one your engine scores highest on \u2014 usually it's exports if your readiness > 50.`
    ].join(" ")
  });
}
function composeScaling(b, s, sections) {
  const exportReadiness = b.twin.health_summary.export_readiness;
  const digitalReadiness = b.twin.health_summary.digital_maturity;
  sections.push(
    findings(
      [
        {
          id: "sc-exp",
          title: `Export readiness: ${Math.round(exportReadiness)}/100`,
          tone: exportReadiness >= 50 ? "success" : "warn"
        },
        {
          id: "sc-dig",
          title: `Digital readiness: ${Math.round(digitalReadiness)}/100`,
          tone: digitalReadiness >= 50 ? "success" : "warn"
        },
        {
          id: "sc-fit",
          title: "Scaling fit",
          tone: s.healthScore >= 60 ? "success" : "warn",
          subtitle: s.healthScore >= 60 ? "Score supports a small geography rollout." : "Tighten operations first; revisit in 60 days."
        }
      ],
      "Scaling posture"
    )
  );
  sections.push(
    recommendations(
      [
        asBulletFor(
          "Pilot a new geography (30 days)",
          "Ship a small test shipment; verify duty + payment cycles before scaling.",
          "primary",
          "+8 pts",
          "Moderate",
          "60 days"
        ),
        asBulletFor(
          "Launch a second sales channel",
          "Marketplace OR B2B OR D2C \u2014 not all three at once.",
          "info",
          "+12 pts",
          "Moderate",
          "45 days"
        ),
        asBulletFor(
          "Add a flagship SKU to the catalogue",
          "Highest-margin / lowest-CAC line first.",
          "violet",
          "+18 pts",
          "Easy",
          "30 days"
        )
      ],
      "Scaling vectors ranked"
    )
  );
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.scaling));
}
function whatFirstSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `What to do first for **${s.legalName}**. One critical + one high + one quick-win, in that order.`
    ].join(" ")
  });
}
function composeWhatFirst(b, s, sections) {
  const items = b.recommendations.recommendations.slice().sort((a, b2) => {
    const p = priorityWeight2(a.priority) - priorityWeight2(b2.priority);
    if (p !== 0) return p;
    return b2.estimated_score_gain - a.estimated_score_gain;
  }).slice(0, 5);
  sections.push(recommendations(items.map(asBullet), "Sequenced first moves"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, items.map(asBullet)));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.what_first));
}
function exportSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Export opportunities for **${s.legalName}** (${s.revenueBand.label} business).`,
      `Five priority moves per category, ranked by score-gain.`
    ].join(" ")
  });
}
function composeExport(b, s, sections) {
  const items = b.recommendations.recommendations.filter((r) => r.category === "export_readiness_actions").slice().sort((a, b2) => b2.estimated_score_gain - a.estimated_score_gain).slice(0, 5);
  if (items.length === 0) {
    sections.push(
      findings(
        [
          {
            id: "exp-none",
            title: "No export-readiness actions surfaced yet",
            subtitle: "Update the Business Profile with IEC + destination interest.",
            tone: "warn"
          }
        ],
        "Export posture"
      )
    );
  } else {
    sections.push(recommendations(items.map(asBullet), "Top 5 export plays"));
  }
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.export_opportunities));
}
function dnaSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Business DNA for **${s.legalName}** is ${s.dnaArchetype} at ${s.dnaMatch}% match.`,
      `Everything below is calibrated to this archetype.`
    ].join(" ")
  });
}
function composeDna(_b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "dna-arch",
          title: s.dnaArchetype,
          subtitle: `Match score ${s.dnaMatch}%`,
          tone: "violet"
        },
        {
          id: "dna-scores",
          title: "Pillars that define the archetype",
          tone: "info",
          meta: "Computed from your business profile signals."
        }
      ],
      "Archetype read"
    )
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
          "1 week"
        ),
        asBulletFor(
          "Avoid archetype risks",
          "Foundations grind on cash-flow; Leaders stretch on hiring.",
          "info",
          "Risk reduction",
          "Easy",
          "1 day"
        ),
        asBulletFor(
          "Improve DNA match to 75%+",
          "Higher match = better recommendations; lower match = wider variance.",
          "violet",
          "+5% match",
          "Moderate",
          "1 month"
        )
      ],
      "DNA-driven recommendations"
    )
  );
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.business_dna));
}
function roadmapSummary(b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Your roadmap has **${s.roadmapTotalItems} items** projected across **${b.roadmap.summary.total_estimated_duration}**.`,
      `Projected end-state: business score ${s.projectedScore}/100, +${s.estimatedScoreGain} pts, ~${s.estimatedRoi}% modelled ROI.`
    ].join(" ")
  });
}
function composeRoadmap(b, s, sections) {
  const items = b.roadmap.items.slice(0, 5).map((it) => ({
    id: it.recommendation_id,
    title: it.title,
    subtitle: `${it.phase} \xB7 priority ${it.priority}`,
    tone: "info",
    impact: `+${Math.round(it.expected_score_improvement || 0)} pts \xB7 ${Math.round(it.estimated_roi || 0)}% ROI`,
    time: it.estimated_duration
  }));
  sections.push(recommendations(items, "Roadmap by phase"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_roadmap));
}
function recommendationsSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Recommendations queue for **${s.legalName}**: ${s.recommendationCount} items, ${s.criticalRecommendations} critical + ${s.highRecommendations} high.`
    ].join(" ")
  });
}
function composeRecommendations(b, s, sections) {
  sections.push(recommendations(b.recommendations.recommendations.slice(0, 5).map(asBullet), "Top recommendations"));
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_recommendations));
}
function insightsSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `AI Decision insights for ${s.legalName}. Below: the top 5 insights + how each is grounded.`
    ].join(" ")
  });
}
function composeInsights(b, s, sections) {
  const decision = b.decision;
  if (!decision) {
    sections.push(
      findings(
        [
          {
            id: "ins-none",
            title: "No AI Decision output yet",
            subtitle: "Re-run the advisor to refresh insights.",
            tone: "warn"
          }
        ],
        "Insights"
      )
    );
  } else {
    sections.push(
      findings(
        decision.decision.insights.slice(0, 5).map((ins) => ({
          id: ins.id,
          title: ins.title,
          subtitle: ins.explanation,
          tone: ins.priority === "Critical" ? "danger" : ins.priority === "High" ? "warn" : "info",
          meta: `${ins.priority} \xB7 confidence ${ins.confidence}%`
        })),
        "Top insights"
      )
    );
  }
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_insights));
}
function rulesSummaryFn(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Active rule firings: **${s.rulesFiring}**. Each one is a direct opportunity waiting to be actioned.`
    ].join(" ")
  });
}
function composeRulesFn(b, _s, sections) {
  const items = [];
  for (const cat of Object.values(b.rules.categories)) {
    if (!cat || !Array.isArray(cat.firings)) continue;
    for (const f of cat.firings.slice(0, 3)) {
      items.push({
        id: f.id,
        title: f.title,
        subtitle: f.description,
        tone: f.priority === "Critical" ? "danger" : f.priority === "High" ? "warn" : "info",
        meta: `${f.priority} \xB7 ${f.category.replace(/_/g, " ")}`
      });
    }
  }
  sections.push(findings(items, "Top rule firings"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.explain_rules));
}
function overviewSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Business overview for **${s.legalName}**. Score **${s.healthScore}/100** (${s.healthBand}), DNA ${s.dnaArchetype} at ${s.dnaMatch}%, ${s.rulesFiring} rule firings, ${s.recommendationCount} actions queued.`
    ].join(" ")
  });
}
function composeOverview(b, s, sections) {
  sections.push(
    findings(
      [
        {
          id: "ov-score",
          title: `Overall score: ${s.healthScore}/100 (${s.healthBand})`,
          tone: s.healthScore >= 60 ? "success" : "warn"
        },
        {
          id: "ov-dna",
          title: `DNA: ${s.dnaArchetype} (${s.dnaMatch}%)`,
          tone: "violet"
        },
        {
          id: "ov-recs",
          title: `${s.recommendationCount} recommendations queued`,
          tone: "info",
          subtitle: `${s.criticalRecommendations} critical \xB7 ${s.highRecommendations} high`
        },
        {
          id: "ov-roadmap",
          title: `Roadmap: ${s.roadmapTotalItems} items, projected score ${s.projectedScore}/100`,
          tone: "info"
        }
      ],
      "The big picture"
    )
  );
  sections.push(
    recommendations(
      bulletsForSnapshot(s, b.recommendations.recommendations).slice(0, 5),
      "Where to start"
    )
  );
  sections.push(impactFromSnapshot(s));
  sections.push(actionPlanSection(b, s, []));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.general_overview));
}
function decisionHireSummary(_b, s, _p) {
  const verdict = decideHireVerdict(s);
  return section("summary", "Executive Summary", {
    body: [
      `**Should I hire?** for ${s.legalName} \u2014 ${verdict === "YES" ? "yes" : verdict === "WAIT" ? "wait" : "not yet"} (verdict: ${verdict}).`,
      `Three forces drive the verdict: business score, DNA match, and revenue band.`
    ].join(" ")
  });
}
function decideHireVerdict(s) {
  if (s.healthScore >= 55 && s.dnaMatch >= 40) return "YES";
  if (s.healthScore >= 40 && s.healthScore < 55) return "WAIT";
  return "NO";
}
function composeDecisionHire(b, s, sections) {
  sections.push(decisionSectionFor(b, s, "hire"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_hire));
}
function decisionExpandSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `**Should I expand?** for ${s.legalName} \u2014 depends on export readiness + digital readiness + score.`,
      `The card below gives a deterministic verdict + the ROI, timeline and risk lines.`
    ].join(" ")
  });
}
function composeDecisionExpand(b, s, sections) {
  sections.push(decisionSectionFor(b, s, "expand"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_expand));
}
function decisionLoanSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `**Should I apply for a loan?** for ${s.legalName}.`,
      `The card below gives the verdict + interest-rate band and the docs you'll need.`
    ].join(" ")
  });
}
function composeDecisionLoan(b, s, sections) {
  sections.push(decisionSectionFor(b, s, "loan"));
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.decision_loan));
}
function actionPlanSummary(_b, s, _p) {
  return section("summary", "Executive Summary", {
    body: [
      `Action plan for **${s.legalName}** \u2014 4-week ramp for the highest-leverage move.`,
      `Each week is a checkpoint; each step is one person-day of work.`
    ].join(" ")
  });
}
function composeActionPlan(b, s, sections) {
  const top = s.topRecommendations[0];
  if (top) {
    const rec = b.recommendations.recommendations.find((r) => r.id === top.id);
    if (rec) {
      sections.push(actionPlanSection(b, s, [asBullet(rec)]));
    }
  }
  sections.push(nextQuestionsLabels(NEXT_QUESTIONS.action_plan));
}
function fallbackSummary(b, _s, prompt) {
  return section("summary", "Executive Summary", {
    body: [
      `I read your question ("${prompt.slice(0, 240)}") against every payload the platform tracks.`,
      `The closest intent I found matches the general overview. If that doesn't fit, try one of the Next Questions below.`
    ].join(" ")
  });
}
function composeFallback(b, s, sections) {
  composeOverview(b, s, sections);
}
function decisionSectionFor(b, s, kind) {
  const payload = buildDecisionCard(b, s, kind);
  return section("decision", "Decision support", {
    caption: `${payload.question} \xB7 verdict ${payload.verdict}`,
    decision: payload
  });
}
function buildDecisionCard(b, s, kind) {
  if (kind === "hire") {
    const ready = s.healthScore >= 55 && s.dnaMatch >= 40;
    const borderline2 = s.healthScore >= 40 && s.healthScore < 55;
    const verdict2 = ready ? "YES" : borderline2 ? "WAIT" : "NO";
    const verdictTone2 = verdict2 === "YES" ? "success" : verdict2 === "WAIT" ? "warn" : "danger";
    return {
      question: "Should I Hire?",
      verdict: verdict2,
      verdictTone: verdictTone2,
      headline: verdict2 === "YES" ? "Hire now \u2014 operational score is above threshold." : verdict2 === "WAIT" ? "Hold \u2014 stabilise the baseline first." : "Not yet \u2014 too many open risks on the table.",
      why: `Score ${s.healthScore}/100 (${s.healthBand}), DNA match ${s.dnaMatch}%, revenue band ${s.revenueBand.label}.`,
      risks: verdict2 === "YES" ? [
        "Cash-buffer compression if payroll slips.",
        "Wrong hire burns 3 months of runway."
      ] : ["Adding fixed cost before runway clears will compound the score gap."],
      roi: verdict2 === "YES" ? "Sales hire: payback <4 months \xB7 Ops hire: 30-50% throughput lift" : "Outsource / fractional first \u2014 better ROI while score rebuilds.",
      timeline: ready ? "30 days to onboard" : "Re-evaluate in 60 days",
      confidence: clampScore(40 + s.healthScore / 2 - s.activeRisks * 4)
    };
  }
  if (kind === "expand") {
    const exportReady = b.twin.health_summary.export_readiness;
    const digitalReady = b.twin.health_summary.digital_maturity;
    const ready = s.healthScore >= 60 && exportReady >= 50;
    const borderline2 = s.healthScore >= 45 && s.healthScore < 60;
    const verdict2 = ready ? "YES" : borderline2 ? "WAIT" : "NO";
    const verdictTone2 = verdict2 === "YES" ? "success" : verdict2 === "WAIT" ? "warn" : "danger";
    return {
      question: "Should I Expand?",
      verdict: verdict2,
      verdictTone: verdictTone2,
      headline: verdict2 === "YES" ? "Open a new geography or channel this quarter." : verdict2 === "WAIT" ? "Wait \u2014 close the operational baseline first." : "Defend the core first.",
      why: `Score ${s.healthScore}/100, export readiness ${Math.round(exportReady)}, digital readiness ${Math.round(digitalReady)}.`,
      risks: verdict2 === "YES" ? [
        "FX + duty exposure on the new geography.",
        "Hiring / logistics capacity strain if the pilot scales."
      ] : ["Expanding before the baseline is set amplifies whatever is broken."],
      roi: "New geography: 2\xD7 revenue, 6-12 months payback. New channel: 30-45 days to validation.",
      timeline: ready ? "30-day pilot, 90-day scale decision" : "Re-evaluate in 90 days",
      confidence: clampScore(45 + s.healthScore / 2 - s.activeRisks * 3)
    };
  }
  const loanReady = b.recommendations.summary.total_estimated_roi >= 35 && s.healthScore >= 50;
  const borderline = s.healthScore >= 40 && s.healthScore < 50;
  const verdict = loanReady ? "YES" : borderline ? "WAIT" : "NO";
  const verdictTone = verdict === "YES" ? "success" : verdict === "WAIT" ? "warn" : "danger";
  return {
    question: "Should I apply for a Loan?",
    verdict,
    verdictTone,
    headline: verdict === "YES" ? "Apply now \u2014 readiness score supports approval." : verdict === "WAIT" ? "Build the readiness checklist first." : "Not yet \u2014 readiness score is below threshold.",
    why: `Score ${s.healthScore}/100, total estimated ROI ${s.estimatedRoi}%, capital-readiness inference from score.`,
    risks: verdict === "YES" ? [
      "Fixed cost if revenue doesn't lift as forecast.",
      "Collateral exposure if the loan is secured."
    ] : ["Borrowing without readiness compounds the score gap."],
    roi: "Effective rate 9-14% for collateral-free (CGTMSE), 10-12% for term loan.",
    timeline: loanReady ? "45-60 days from application to disbursement" : "Re-evaluate in 90 days",
    confidence: clampScore(40 + s.healthScore / 2 + (s.estimatedRoi > 35 ? 8 : 0))
  };
}
function actionPlanSection(b, s, bullets) {
  const empty = {
    key: "action_plan",
    title: "Week-by-week action plan",
    caption: "Action plan will populate once a top recommendation is selected.",
    weeks: []
  };
  if (bullets.length === 0) return empty;
  const top = bullets[0];
  const rec = b.recommendations.recommendations.find((r) => r.title === top.title);
  const weeks = rec ? actionWeeksFromRecommendation(rec) : generateGenericWeeks(top.title);
  return section("action_plan", "Week-by-week action plan", {
    caption: `Plan for "${top.title}" \u2014 ${b.roadmap.summary.total_estimated_duration} target.`,
    weeks
  });
}
function generateGenericWeeks(title) {
  return actionWeeksFromRecommendation({
    id: "generic",
    title,
    category: "high_priority",
    priority: "High"
  });
}
function commonSources(topics) {
  return topics.map((topic) => ({
    topic,
    detail: `Drawn from the ${topic} payload.`
  }));
}
function improveSources(b, s) {
  return commonSources(["Twin", "Recommendations", "Roadmap"]);
}
function lowScoreSources(b, s) {
  return commonSources(["Twin", "Recommendations", "Rules"]);
}
function growthSources(b, s) {
  return commonSources(["Twin", "Marketing", "Roadmap"]);
}
function digitalSources(b, s) {
  return commonSources(["Twin", "Digital", "Roadmap"]);
}
function financeSources(b, s) {
  return commonSources(["Twin", "Government Schemes", "Recommendations"]);
}
function overviewSources(b, s) {
  return commonSources(["Twin", "Recommendations", "Roadmap", "Business DNA", "Rules"]);
}
function renderPlainText(sections, _snapshot) {
  const lines = [];
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
        if (b.subtitle) line = `${line} \u2014 ${b.subtitle}`;
        if (b.impact) line = `${line} (${b.impact})`;
        lines.push(line);
      }
    }
    if (s.weeks) {
      for (const w of s.weeks) {
        lines.push(`
${w.week}`);
        for (const step of w.steps) lines.push(`- ${step}`);
      }
    }
    lines.push("");
  }
  return lines.filter(Boolean).join("\n").trim();
}
function priorityWeight2(p) {
  if (p === "Critical") return 0;
  if (p === "High") return 1;
  if (p === "Medium") return 2;
  return 3;
}
function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function asBulletFor(title, subtitle, tone, impact, difficulty, time) {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    subtitle,
    tone,
    impact,
    difficulty,
    time,
    confidence: 75,
    riskIfIgnored: "Score will stay flat for the next quarter."
  };
}
var NEXT_QUESTIONS = {
  improve_business: [
    { id: "ib-quick", label: "Give me a quick win" },
    { id: "ib-budget", label: "What can I do with a small budget?" },
    { id: "ib-deadline", label: "Which action has the shortest timeline?" }
  ],
  low_score: [
    { id: "ls-quick-win", label: "Show me a quick win" },
    { id: "ls-rule", label: "Explain the engine findings" },
    { id: "ls-roadmap", label: "Walk me through the roadmap" }
  ],
  growth_strategy: [
    { id: "gs-channel", label: "Best channel for me" },
    { id: "gs-export", label: "Export opportunities" },
    { id: "gs-plan", label: "Build me a quarterly plan" }
  ],
  digital_transformation: [
    { id: "dt-website", label: "Should I launch a website?" },
    { id: "dt-payments", label: "Set up digital payments" },
    { id: "dt-roi", label: "What is the ROI?" }
  ],
  finance: [
    { id: "fin-cost", label: "Cost of capital" },
    { id: "fin-loan", label: "Should I apply for a loan?" },
    { id: "fin-cash", label: "Cash-flow plan" }
  ],
  gst: [
    { id: "gst-cost", label: "Costs" },
    { id: "gst-deadline", label: "Deadline" },
    { id: "gst-penalty", label: "Penalties" }
  ],
  government_schemes: [
    { id: "gs-elig", label: "Check Eligibility" },
    { id: "gs-compare", label: "Compare with MUDRA" },
    { id: "gs-docs", label: "Required Documents" }
  ],
  marketing: [
    { id: "mkt-channel", label: "Best channel for me" },
    { id: "mkt-budget", label: "Cheapest acquisition" },
    { id: "mkt-content", label: "Content cadence" }
  ],
  operations: [
    { id: "ops-inv", label: "Digitise inventory" },
    { id: "ops-hire", label: "Should I Hire?" },
    { id: "ops-supplier", label: "Supplier risk" }
  ],
  hiring: [
    { id: "h-yes", label: "Should I Hire?" },
    { id: "h-role", label: "First role" },
    { id: "h-cost", label: "Cost of hire" }
  ],
  compliance: [
    { id: "c-list", label: "Full compliance checklist" },
    { id: "c-tax", label: "Tax calendar" },
    { id: "c-penalty", label: "Risk of ignoring" }
  ],
  risk: [
    { id: "r-top", label: "Top 3 risks" },
    { id: "r-mitigate", label: "Mitigation plan" },
    { id: "r-insurance", label: "Insurance options" }
  ],
  scaling: [
    { id: "sc-expand", label: "Should I Expand?" },
    { id: "sc-hire", label: "Hire for scale" },
    { id: "sc-finance", label: "Capital for scale" }
  ],
  decision_hire: [
    { id: "dh-role", label: "What role?" },
    { id: "dh-cost", label: "Cost calculator" },
    { id: "dh-alt", label: "Outsource alternative" }
  ],
  decision_expand: [
    { id: "de-market", label: "Best market to enter" },
    { id: "de-cost", label: "Cost of expansion" },
    { id: "de-risk", label: "Expansion risk" }
  ],
  decision_loan: [
    { id: "dl-scheme", label: "Government loan instead?" },
    { id: "dl-readiness", label: "Loan readiness score" },
    { id: "dl-cost", label: "Effective interest rate" }
  ],
  action_plan: [
    { id: "ap-track", label: "Track progress" },
    { id: "ap-risk", label: "Risk if I skip a week" },
    { id: "ap-review", label: "Monthly review cadence" }
  ],
  what_first: [
    { id: "wf-quick", label: "Quickest first move" },
    { id: "wf-recs", label: "Explain the priority list" },
    { id: "wf-roadmap", label: "Walk me through the roadmap" }
  ],
  export_opportunities: [
    { id: "exp-elig", label: "Check my export eligibility" },
    { id: "exp-mkt", label: "Best markets for my product" },
    { id: "exp-docs", label: "Required documents" }
  ],
  business_dna: [
    { id: "dna-improve", label: "Improve my DNA match" },
    { id: "dna-archetype", label: "What does my archetype value?" },
    { id: "dna-industry", label: "How do my peers score?" }
  ],
  explain_roadmap: [
    { id: "rm-first", label: "Which phase first?" },
    { id: "rm-deps", label: "Dependencies that block" },
    { id: "rm-duration", label: "How long is the roadmap?" }
  ],
  explain_recommendations: [
    { id: "rc-critical", label: "Most critical recommendation" },
    { id: "rc-cheap", label: "Cheapest recommendation" },
    { id: "rc-fast", label: "Fastest recommendation" }
  ],
  explain_insights: [
    { id: "in-patterns", label: "Patterns in my business" },
    { id: "in-low", label: "Where is my analysis weakest?" },
    { id: "in-summary", label: "One-line summary" }
  ],
  explain_rules: [
    { id: "rul-crit", label: "Critical rules" },
    { id: "rul-resolved", label: "Resolved rules" },
    { id: "rul-impact", label: "Highest-impact rule" }
  ],
  general_overview: [
    { id: "ov-health", label: "Business health" },
    { id: "ov-dna", label: "Explain my Business DNA" },
    { id: "ov-recs", label: "Show top recommendations" }
  ]
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildConsultantResponse,
  formatRoi,
  formatScoreGain
});
