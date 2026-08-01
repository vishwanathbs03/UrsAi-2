"use client";

import type { RuleCategory, RulePriority } from "@/types/dashboard";
import type {
  InsightCategoryKey,
  InsightItem,
} from "./use-insights-data";

// --------------------------------------------------------------------------- //
// Spec categories
// --------------------------------------------------------------------------- //

export const INSIGHT_CATEGORIES: { key: InsightCategoryKey; label: string; description: string }[] = [
  {
    key: "opportunities",
    label: "Opportunities",
    description: "Areas where a small action unlocks outsized growth.",
  },
  {
    key: "risks",
    label: "Risks",
    description: "Open risks the engine is actively watching.",
  },
  {
    key: "growth",
    label: "Growth",
    description: "Market expansion, customer reach, and revenue levers.",
  },
  {
    key: "compliance",
    label: "Compliance",
    description: "Regulatory, certification, and policy posture.",
  },
  {
    key: "digital",
    label: "Digital",
    description: "Digital channels, ecommerce, and cloud adoption.",
  },
  {
    key: "export",
    label: "Export",
    description: "International-readiness and export enablement.",
  },
];

// --------------------------------------------------------------------------- //
// Filter model
// --------------------------------------------------------------------------- //

export type CategoryFilter = "all" | InsightCategoryKey;
export type PriorityFilter = "all" | RulePriority;
export type ConfidenceFilter = "all" | "high" | "medium" | "low";

export interface InsightsFilters {
  query: string;
  category: CategoryFilter;
  priority: PriorityFilter;
  confidence: ConfidenceFilter;
}

export const DEFAULT_INSIGHTS_FILTERS: InsightsFilters = {
  query: "",
  category: "all",
  priority: "all",
  confidence: "all",
};

export const PRIORITY_FILTER_OPTIONS: PriorityFilter[] = [
  "all",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const CONFIDENCE_FILTER_OPTIONS: { value: ConfidenceFilter; label: string }[] = [
  { value: "all", label: "All confidence" },
  { value: "high", label: "High (≥ 70%)" },
  { value: "medium", label: "Medium (40-69%)" },
  { value: "low", label: "Low (< 40%)" },
];

export const CATEGORY_FILTER_OPTIONS: CategoryFilter[] = [
  "all",
  "opportunities",
  "risks",
  "growth",
  "compliance",
  "digital",
  "export",
];

export function isFiltersActive(filters: InsightsFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.category !== "all" ||
    filters.priority !== "all" ||
    filters.confidence !== "all"
  );
}

// --------------------------------------------------------------------------- //
// Classifier — maps the raw AI category (and the related
// recommendations' categories) into the six spec categories.
// No new business logic: the mapping is just a normalisation
// of strings the upstream payloads already use.
// --------------------------------------------------------------------------- //

const KEYWORD_TO_CATEGORY: Array<{
  keywords: string[];
  target: InsightCategoryKey;
}> = [
  {
    keywords: ["risk", "alert", "warning", "threat", "vulnerab"],
    target: "risks",
  },
  {
    keywords: ["opportunity", "opportunit", "potential", "untapped", "unlock"],
    target: "opportunities",
  },
  {
    keywords: ["growth", "expand", "scale", "revenue", "market", "customer"],
    target: "growth",
  },
  {
    keywords: ["compliance", "regulation", "regulatory", "certif", "policy"],
    target: "compliance",
  },
  {
    keywords: ["digital", "ecommerce", "cloud", "online", "website", "social"],
    target: "digital",
  },
  {
    keywords: ["export", "international", "trade", "iec", "foreign"],
    target: "export",
  },
];

// Rule-engine category keys map to the spec category in one
// step (no keyword scanning needed).
const RULE_CATEGORY_MAP: Partial<Record<RuleCategory, InsightCategoryKey>> = {
  risk_alerts: "risks",
  immediate_actions: "opportunities",
  high_priority: "opportunities",
  medium_priority: "opportunities",
  long_term: "opportunities",
  compliance_actions: "compliance",
  export_readiness_actions: "export",
  digital_transformation_actions: "digital",
};

export interface ClassifyInput {
  /** The category string the AI Decision engine returned. */
  aiCategory: string;
  /** Categories of the related recommendations (rule keys). */
  recommendationCategories: string[];
}

export function classifyInsightCategory(input: ClassifyInput): InsightCategoryKey {
  const { aiCategory, recommendationCategories } = input;
  const haystack = [aiCategory, ...recommendationCategories]
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  for (const s of haystack) {
    // Exact match against the rule-engine category map.
    const ruleMapHit = RULE_CATEGORY_MAP[s as RuleCategory];
    if (ruleMapHit) return ruleMapHit;
    // Keyword scan against the raw AI category.
    for (const entry of KEYWORD_TO_CATEGORY) {
      if (entry.keywords.some((kw) => s.includes(kw))) {
        return entry.target;
      }
    }
  }
  // Sensible default for unmapped categories.
  return "opportunities";
}

// --------------------------------------------------------------------------- //
// Apply filters (pure)
// --------------------------------------------------------------------------- //

function confidenceBand(c: number): "high" | "medium" | "low" {
  if (c >= 70) return "high";
  if (c >= 40) return "medium";
  return "low";
}

export function applyInsightFilters(
  items: InsightItem[],
  filters: InsightsFilters,
): InsightItem[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.category !== "all" && it.category !== filters.category) {
      return false;
    }
    if (filters.priority !== "all" && it.priority !== filters.priority) {
      return false;
    }
    if (
      filters.confidence !== "all" &&
      confidenceBand(it.confidence) !== filters.confidence
    ) {
      return false;
    }
    if (q) {
      const hay = [
        it.title,
        it.explanation,
        it.rawCategory,
        it.priority,
        ...it.supportingRuleIds,
        ...it.supportingArticleIds,
        ...it.relatedRecommendations.map((r) => r.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function countByCategory(
  items: InsightItem[],
): Record<InsightCategoryKey, number> {
  const out: Record<InsightCategoryKey, number> = {
    opportunities: 0,
    risks: 0,
    growth: 0,
    compliance: 0,
    digital: 0,
    export: 0,
  };
  for (const it of items) {
    out[it.category] = (out[it.category] ?? 0) + 1;
  }
  return out;
}
