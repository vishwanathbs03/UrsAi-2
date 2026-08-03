export interface BusinessDNAData {
  business_stage: string;
  digital_maturity: string;
  operational_complexity: string;
  growth_potential: string;
  market_position: string;
  automation_level: string;
  risk_profile: string;
  overall_dna: string;
}

export interface DNAPayload {
  archetype: {
    key: string;
    title: string;
    description: string;
    match_score: number;
  };
  business_dna?: BusinessDNAData;
}

export interface SWOTItem {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

export interface SWOTReport {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}

export interface ReadinessDimensionItem {
  dimension: string;
  score: number;
  level: string;
  details: string;
}

export interface ReadinessReport {
  overall_score: number;
  grade: string;
  breakdown: ReadinessDimensionItem[];
}

export interface BenchmarkMetric {
  metric_name: string;
  user_score: number;
  industry_average: number;
  difference: number;
  percentile: number;
  status: 'above_average' | 'average' | 'below_average';
}

export interface BenchmarkReport {
  industry: string;
  overall_benchmark_score: number;
  benchmark_grade: string;
  metrics: BenchmarkMetric[];
}

export interface OpportunityItem {
  id: string;
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  impact: 'High' | 'Medium' | 'Low';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimated_value: number;
  category: string;
}

export interface OpportunityReport {
  total_count: number;
  total_estimated_value: number;
  opportunities: OpportunityItem[];
  /** ISO currency code (e.g. "INR", "USD"); null/undefined means
   *  the currency is unspecified and the UI must NOT assume USD. */
  currency?: string | null;
}

export interface FullBusinessIntelligencePayload {
  generated_at: string;
  dna?: DNAPayload;
  swot?: SWOTReport;
  readiness?: ReadinessReport;
  benchmark?: BenchmarkReport;
  opportunities?: OpportunityReport;
}
