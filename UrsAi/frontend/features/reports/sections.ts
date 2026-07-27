/**
 * Static registry of report sections.
 *
 * One source of truth for:
 *   - the section list rendered as <ReportSection> anchors
 *   - the sidebar TOC links
 *   - the jump-to navigation
 *
 * Adding or reordering a section here is the only place that needs to
 * change. Section components live in `./sections/<key>.tsx` and
 * receive the bundled reports data as their single prop.
 */

export type ReportSectionKey =
  | "business-profile"
  | "executive-summary"
  | "business-health"
  | "business-scores"
  | "business-dna"
  | "intelligence-summary"
  | "rule-summary"
  | "recommendation-summary"
  | "roadmap-summary"
  | "risk-summary"
  | "opportunity-summary"
  | "analytics-summary";

export interface ReportSectionMeta {
  key: ReportSectionKey;
  id: string;
  badge: string;
  title: string;
  /** One-line subtitle used in the section header. */
  caption: string;
}

export const REPORT_SECTIONS: ReportSectionMeta[] = [
  {
    key: "business-profile",
    id: "report-business-profile",
    badge: "Profile",
    title: "Business Profile",
    caption: "Identity and operational footprint from the Digital Twin.",
  },
  {
    key: "executive-summary",
    id: "report-executive-summary",
    badge: "Summary",
    title: "Executive Summary",
    caption: "High-level read of where the business stands today.",
  },
  {
    key: "business-health",
    id: "report-business-health",
    badge: "Health",
    title: "Business Health",
    caption: "Maturity across the ten readiness dimensions.",
  },
  {
    key: "business-scores",
    id: "report-business-scores",
    badge: "Scores",
    title: "Business Scores",
    caption: "Per-pillar scores, levels, and band distribution.",
  },
  {
    key: "business-dna",
    id: "report-business-dna",
    badge: "DNA",
    title: "Business DNA",
    caption: "Archetype, secondary traits, and SWOT quadrants.",
  },
  {
    key: "intelligence-summary",
    id: "report-intelligence-summary",
    badge: "Intelligence",
    title: "Intelligence Summary",
    caption: "Profile intelligence and per-analyzer coverage.",
  },
  {
    key: "rule-summary",
    id: "report-rule-summary",
    badge: "Rules",
    title: "Rule Summary",
    caption: "Engine firings by priority and category.",
  },
  {
    key: "recommendation-summary",
    id: "report-recommendation-summary",
    badge: "Recommendations",
    title: "Recommendation Summary",
    caption: "Top recommendations and aggregate ROI / impact.",
  },
  {
    key: "roadmap-summary",
    id: "report-roadmap-summary",
    badge: "Roadmap",
    title: "Roadmap Summary",
    caption: "Execution phases, completion, and projected lift.",
  },
  {
    key: "risk-summary",
    id: "report-risk-summary",
    badge: "Risks",
    title: "Risk Summary",
    caption: "Critical, active, resolved, and emerging risks.",
  },
  {
    key: "opportunity-summary",
    id: "report-opportunity-summary",
    badge: "Opportunities",
    title: "Opportunity Summary",
    caption: "Opportunity buckets from the Digital Twin matrix.",
  },
  {
    key: "analytics-summary",
    id: "report-analytics-summary",
    badge: "Analytics",
    title: "Analytics Summary",
    caption: "Trends, readiness breakdown, and analytics overview.",
  },
];
