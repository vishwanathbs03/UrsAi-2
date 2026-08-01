/**
 * TypeScript types for the dashboard's backend payloads.
 *
 * These mirror the Pydantic schemas in `backend/app/schemas/*` —
 * not byte-for-byte (we drop a few nested fields the UI never
 * reads) but the field names match the wire format so the
 * service modules can hand the parsed JSON straight through.
 */

// --------------------------------------------------------------------------- //
// Levels
// --------------------------------------------------------------------------- //

export type ScoreLevel = "Low" | "Medium" | "High" | "Excellent";
export type IntelligenceLevel = "low" | "medium" | "high";
export type RulePriority = "Critical" | "High" | "Medium" | "Low";

// --------------------------------------------------------------------------- //
// /business/intelligence
// --------------------------------------------------------------------------- //

export interface IntelligenceBreakdownItem {
  key: string;
  label: string;
  weight: number;
  earned: number;
  present: boolean;
  hint?: string | null;
}

export interface IntelligenceAnalyzer {
  key: string;
  title: string;
  score: number;
  level: IntelligenceLevel;
  summary: string;
  breakdown: IntelligenceBreakdownItem[];
  missing: string[];
}

export interface IntelligenceOverall {
  score: number;
  level: IntelligenceLevel;
  analyzer_count: number;
}

import type {
  DNAPayload,
  SWOTReport,
  ReadinessReport,
  BenchmarkReport,
  OpportunityReport,
} from "./intelligence";

export interface IntelligenceResponse {
  generated_at: string;
  overall: IntelligenceOverall;
  analyzers: IntelligenceAnalyzer[];
  dna?: DNAPayload;
  swot?: SWOTReport;
  readiness?: ReadinessReport;
  benchmark?: BenchmarkReport;
  opportunities?: OpportunityReport;
}

// --------------------------------------------------------------------------- //
// /business/scores
// --------------------------------------------------------------------------- //

export interface BusinessScore {
  key: string;
  title: string;
  score: number;
  level: ScoreLevel;
  band: ScoreLevel; // some shapes include both; tolerate either
  description?: string;
  factors?: { key: string; label: string; weight: number; earned: number }[];
}

export interface ScoresSummary {
  score: number;
  level: ScoreLevel;
  weighted_inputs: number;
  band_distribution: Record<ScoreLevel, number>;
}

export interface ScoresResponse {
  generated_at: string;
  summary: ScoresSummary;
  scores: BusinessScore[];
}

// --------------------------------------------------------------------------- //
// /business/dna
// --------------------------------------------------------------------------- //

export interface DnaArchetype {
  key: string;
  title: string;
  match_score: number;
  description?: string;
  rationale?: { key: string; label: string; value: number }[];
  runner_up_key?: string | null;
  runner_up_score?: number;
}

export interface DnaSecondaryTrait {
  key: string;
  title: string;
  present: boolean;
  strength: number;
  rationale?: { key: string; label: string; value: number }[];
}

export interface DnaFinding {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "low" | "medium" | "high";
  category: string;
}

export interface DnaBody {
  archetype: DnaArchetype;
  secondary_traits: DnaSecondaryTrait[];
  strengths: DnaFinding[];
  weaknesses: DnaFinding[];
  opportunities: DnaFinding[];
  risk_areas: DnaFinding[];
  confidence: number;
  confidence_rationale?: string[];
}

export interface DnaResponse {
  generated_at: string;
  inputs?: {
    intelligence_generated_at?: string | null;
    scores_generated_at?: string | null;
  };
  dna: DnaBody;
}

// --------------------------------------------------------------------------- //
// /business/rules
// --------------------------------------------------------------------------- //

export type RuleCategory =
  | "immediate_actions"
  | "high_priority"
  | "medium_priority"
  | "long_term"
  | "risk_alerts"
  | "compliance_actions"
  | "export_readiness_actions"
  | "digital_transformation_actions";

export interface RuleFiring {
  id: string;
  title: string;
  description: string;
  category: RuleCategory;
  priority: RulePriority;
  reason: string;
  source_keys: string[];
  estimated_impact: number;
}

export interface RuleCategoryBlock {
  firing_count: number;
  rules_evaluated: number;
  firings: RuleFiring[];
}

export interface RulesSummary {
  total_firings: number;
  categories_with_firings: number;
  categories_evaluated: number;
  total_estimated_impact: number;
}

export interface RulesInputs {
  intelligence_generated_at: string | null;
  scores_generated_at: string | null;
  dna_generated_at: string | null;
}

export interface RulesResponse {
  generated_at: string;
  inputs: RulesInputs;
  summary: RulesSummary;
  categories: Record<RuleCategory, RuleCategoryBlock>;
}

// --------------------------------------------------------------------------- //
// /business/decision
// --------------------------------------------------------------------------- //

export interface AIDecisionInsight {
  id: string;
  title: string;
  explanation: string;
  category: string;
  priority: RulePriority;
  confidence: number;
  supporting_rule_ids: string[];
  supporting_article_ids: string[];
}

export interface AIDecisionBody {
  summary: string;
  archetype_label: string;
  overall_health: string;
  top_strengths: string[];
  top_risks: string[];
  insights: AIDecisionInsight[];
}

export interface AIDecisionInputs {
  intelligence_generated_at: string | null;
  scores_generated_at: string | null;
  dna_generated_at: string | null;
  rules_generated_at: string | null;
  model: string;
}

export interface AIDecisionResponse {
  generated_at: string;
  inputs: AIDecisionInputs;
  decision: AIDecisionBody;
}
