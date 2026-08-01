/**
 * TypeScript types for analytics payloads — twin, roadmap,
 * and recommendations. Mirrors backend Pydantic schemas.
 */

import type { RuleCategory, RulePriority } from "@/types/dashboard";

// --------------------------------------------------------------------------- //
// Shared literals
// --------------------------------------------------------------------------- //

export type RecommendationPhase =
  | "Immediate"
  | "Short-Term"
  | "Medium-Term"
  | "Long-Term";

export type RecommendationDifficulty =
  | "Easy"
  | "Moderate"
  | "Hard"
  | "Expert";

// --------------------------------------------------------------------------- //
// /business/recommendations
// --------------------------------------------------------------------------- //

export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  priority: RulePriority;
  phase: RecommendationPhase;
  business_impact: number;
  estimated_score_gain: number;
  estimated_roi: number;
  estimated_cost: number;
  estimated_timeline: string;
  difficulty: RecommendationDifficulty;
  confidence: number;
  dependencies: string[];
  supporting_rule_ids: string[];
  supporting_article_ids: string[];
  related_score_keys: string[];
  related_intelligence_keys: string[];
  projected_dna_effect: string;
  status: "planned";
}

export interface RecommendationSummary {
  total_recommendations: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_estimated_impact: number;
  total_estimated_score_gain: number;
  total_estimated_cost: number;
  total_estimated_roi: number;
}

export interface RecommendationInputs {
  rules_generated_at: string | null;
  intelligence_generated_at: string | null;
  scores_generated_at: string | null;
  dna_generated_at: string | null;
  knowledge_total_articles: number;
}

export interface RecommendationsResponse {
  generated_at: string;
  inputs: RecommendationInputs;
  summary: RecommendationSummary;
  recommendations: RecommendationItem[];
}

// --------------------------------------------------------------------------- //
// /business/roadmap
// --------------------------------------------------------------------------- //

export interface RoadmapItem {
  recommendation_id: string;
  title: string;
  phase: RecommendationPhase;
  priority: RulePriority;
  estimated_start_order: number;
  estimated_duration: string;
  expected_score_improvement: number;
  expected_business_impact: number;
  estimated_roi: number;
  dependencies: string[];
  blocked_by: string[];
  unlocks: string[];
  completion_percentage: number;
}

export interface RoadmapProjections {
  projected_business_score: number;
  projected_profile_completion: number;
  projected_business_dna_shift: number;
  projected_export_readiness: number;
  projected_digital_readiness: number;
  projected_growth_readiness: number;
}

export interface RoadmapSummary {
  total_items: number;
  total_estimated_duration: string;
  total_estimated_roi: number;
  projections: RoadmapProjections;
}

export interface RoadmapInputs {
  recommendations_generated_at: string | null;
  rules_generated_at: string | null;
  intelligence_generated_at: string | null;
  scores_generated_at: string | null;
  dna_generated_at: string | null;
}

export interface RoadmapResponse {
  generated_at: string;
  inputs: RoadmapInputs;
  summary: RoadmapSummary;
  items: RoadmapItem[];
}

// --------------------------------------------------------------------------- //
// /business/twin
// --------------------------------------------------------------------------- //

export interface TwinIdentity {
  business_id: number;
  owner_id: number;
  legal_name: string;
  trade_name: string | null;
  industry: string;
  sub_industry: string | null;
  business_type: string | null;
  established_year: number;
  employee_count: number;
  annual_revenue: number;
  revenue_currency: string;
  country: string | null;
  state_region: string | null;
  city: string | null;
  is_completed: boolean;
}

export interface TwinProfileSummary {
  capacity_utilization_pct: number | null;
  monthly_production_units: number | null;
  products_count: number;
  certifications_count: number;
  has_active_certification: boolean;
  has_website: boolean;
  has_ecommerce: boolean;
  uses_digital_marketing: boolean;
  uses_cloud_systems: boolean;
  social_channel_count: number;
  has_iec_number: boolean;
  export_countries: number;
  goals_count: number;
  challenges_count: number;
}

export interface TwinScore {
  key: string;
  title: string;
  score: number;
  level: string;
  explanation: string;
}

export interface TwinScores {
  scores: TwinScore[];
  overall_score: number;
  overall_level: string;
  band_distribution: Record<string, number>;
}

export interface TwinCurrentHealth {
  overall_business_score: number;
  business_dna_match: number;
  business_dna_archetype: string;
  rule_critical_count: number;
  recommendation_count: number;
}

export interface TwinTimelineProjection {
  label: "current" | "3m" | "6m" | "12m";
  months_from_now: number;
  projected_overall_score: number;
  projected_digital_score: number;
  projected_export_score: number;
  projected_compliance_score: number;
  projected_growth_score: number;
  roadmap_completion_pct: number;
  items_completed: number;
  items_remaining: number;
  notes: string;
}

export interface TwinTimeline {
  current: TwinTimelineProjection;
  three_month: TwinTimelineProjection;
  six_month: TwinTimelineProjection;
  twelve_month: TwinTimelineProjection;
}

export interface TwinRiskEntry {
  risk_id: string;
  rule_id: string;
  title: string;
  description: string;
  priority: RulePriority;
  category: string;
  estimated_impact: number;
}

export interface TwinRiskMatrix {
  critical_risks: TwinRiskEntry[];
  high_risks: TwinRiskEntry[];
  medium_risks: TwinRiskEntry[];
  resolved_risks: TwinRiskEntry[];
  emerging_risks: TwinRiskEntry[];
}

export interface TwinOpportunityEntry {
  opportunity_id: string;
  recommendation_id: string;
  roadmap_item: string;
  title: string;
  description: string;
  category: string;
  priority: RulePriority;
  phase: string;
  estimated_score_gain: number;
  estimated_roi: number;
  estimated_timeline: string;
}

export interface TwinOpportunityMatrix {
  quick_wins: TwinOpportunityEntry[];
  strategic_investments: TwinOpportunityEntry[];
  long_term_growth: TwinOpportunityEntry[];
  export_opportunities: TwinOpportunityEntry[];
  digital_opportunities: TwinOpportunityEntry[];
  funding_opportunities: TwinOpportunityEntry[];
}

export interface TwinHealthSummary {
  overall_health: number;
  business_maturity: number;
  digital_maturity: number;
  operational_maturity: number;
  market_readiness: number;
  investment_readiness: number;
  export_readiness: number;
  compliance_readiness: number;
  growth_readiness: number;
  innovation_readiness: number;
  sustainability_readiness: number;
}

/** Forward-looking growth potential. Derived from the
 *  recommendations engine. */
export interface TwinGrowthPotential {
  total_expected_score_gain: number;
  total_expected_roi: number;
  average_estimated_timeline: string;
}

/** Roll-up of the rule-engine's risk firings. */
export interface TwinRiskOverview {
  total_risks: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  top_risk_id: string | null;
}

export interface TwinResponse {
  generated_at: string;
  last_analysis_at: string;
  identity: TwinIdentity;
  profile: TwinProfileSummary;
  scores: TwinScores;
  current_health: TwinCurrentHealth;
  timeline: TwinTimeline;
  risk_matrix: TwinRiskMatrix;
  opportunity_matrix: TwinOpportunityMatrix;
  health_summary: TwinHealthSummary;
  growth_potential: TwinGrowthPotential;
  risk_overview: TwinRiskOverview;
  overall_twin_health: number;
}
