/**
 * TypeScript types for the Autonomous Business Advisor
 * (Sprint 7 Part 5).
 *
 * Mirrors the backend Pydantic schema in
 * `backend/app/schemas/advisor.py` exactly. No additional
 * frontend-only fields. No optional guessing.
 *
 * The advisor is a read-only aggregator over the five
 * existing upstream payloads (Twin, Rules, Recommendations,
 * Roadmap, AI Decision / Insights). The frontend surfaces
 * seven deterministic sections + a one-paragraph business
 * summary + the inputs sidecar that echoes every upstream
 * `generated_at`.
 */

// --------------------------------------------------------------------------- //
// Literals — match the Pydantic `Literal` values 1:1.
// --------------------------------------------------------------------------- //

export type AdvisorSectionKey =
  | "daily_brief"
  | "weekly_summary"
  | "health_review"
  | "priority_changes"
  | "upcoming_risks"
  | "missed_opportunities"
  | "suggested_actions";

export type AdvisorPriority = "Critical" | "High" | "Medium" | "Low";

export type AdvisorSource =
  | "rules"
  | "recommendations"
  | "roadmap"
  | "twin"
  | "decision";

export type AdvisorActionType =
  | "review"
  | "prioritise"
  | "decide"
  | "investigate"
  | "plan"
  | "learn"
  | "monitor"
  | "refresh";

// --------------------------------------------------------------------------- //
// Pieces — match the Pydantic BaseModel fields 1:1.
// --------------------------------------------------------------------------- //

export interface AdvisorAdvice {
  id: string;
  section: AdvisorSectionKey;
  title: string;
  summary: string;
  priority: AdvisorPriority;
  source: AdvisorSource;
  source_key: string;
  evidence_ids: string[];
}

export interface AdvisorAction {
  id: string;
  title: string;
  rationale: string;
  action_type: AdvisorActionType;
  priority: AdvisorPriority;
  source_key: string;
  evidence_ids: string[];
  related_recommendation_id: string | null;
  related_roadmap_id: string | null;
}

export interface AdvisorBusinessSummary {
  legal_name: string;
  industry: string;
  archetype: string;
  overall_score: number;
  overall_level: string;
  band: string;
  dna_match: number;
  rule_critical_count: number;
  rule_high_count: number;
  recommendation_count: number;
  roadmap_items_count: number;
  highest_priority_action: string;
  headline: string;
}

export interface AdvisorHealthReview {
  current_overall_score: number;
  current_overall_level: string;
  projected_3m: number;
  projected_6m: number;
  projected_12m: number;
  delta_3m: number;
  delta_6m: number;
  delta_12m: number;
  band: string;
  risk_count: number;
  opportunity_count: number;
}

export interface AdvisorInputs {
  twin_generated_at: string | null;
  rules_generated_at: string | null;
  recommendations_generated_at: string | null;
  roadmap_generated_at: string | null;
  decision_generated_at: string | null;
  predictive_generated_at: string | null;
  notifications_generated_at: string | null;
}

// --------------------------------------------------------------------------- //
// Envelope — the full response shape returned by
// `GET /api/v1/advisor`.
// --------------------------------------------------------------------------- //

export interface AdvisorResponse {
  generated_at: string;
  advisor_id: string;
  business_summary: AdvisorBusinessSummary;
  daily_brief: AdvisorAdvice[];
  weekly_summary: AdvisorAdvice[];
  health_review: AdvisorHealthReview;
  priority_changes: AdvisorAdvice[];
  upcoming_risks: AdvisorAdvice[];
  missed_opportunities: AdvisorAdvice[];
  suggested_actions: AdvisorAction[];
  inputs: AdvisorInputs;
}

// --------------------------------------------------------------------------- //
// Sprint 12 Aggregated Advisor Interfaces
// --------------------------------------------------------------------------- //

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  priority_score: number;
  impact: string;
  effort: string;
}

export interface RecommendationReport {
  total_count: number;
  recommendations: RecommendationItem[];
}

export interface RiskItem {
  risk: string;
  category: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  recommendation: string;
}

export interface RiskReport {
  overall_risk_level: string;
  total_risks_detected: number;
  risks: RiskItem[];
}

export interface GrowthAdviceItem {
  id: string;
  title: string;
  advice: string;
  category: string;
  priority: string;
  timeline: string;
  expected_impact: string;
}

export interface GrowthAdvisorReport {
  growth_stage: string;
  total_advice_count: number;
  recommendations: GrowthAdviceItem[];
}

export interface FundingChecklistItem {
  task: string;
  completed: boolean;
  category: string;
}

export interface FundingReport {
  loan_readiness_score: number;
  investor_readiness_score: number;
  grant_eligibility_score: number;
  msme_schemes: string[];
  funding_checklist: FundingChecklistItem[];
  /** When false, the advisor view shows "Not yet assessed" for the
   *  funding-related scores and recommends completing the profile. */
  profile_complete?: boolean;
}

export interface ComplianceItem {
  requirement: string;
  status: string;
  category: string;
  due_date: string;
}

export interface ComplianceReport {
  compliance_score: number;
  overall_status: string;
  total_requirements: number;
  items: ComplianceItem[];
}

export interface AdvisorAggregateReport {
  recommendations: RecommendationReport;
  risks: RiskReport;
  growth: GrowthAdvisorReport;
  funding: FundingReport;
  compliance: ComplianceReport;
  /** Optional export-readiness signal — null means we do not have
   *  a real export-readiness score, and the decision board should
   *  render "Data unavailable" instead of a fabricated mid-score. */
  export_readiness?: { score: number | null } | null;
}

export interface AdvisorAggregateResponse {
  generated_at: string;
  report: AdvisorAggregateReport;
}
