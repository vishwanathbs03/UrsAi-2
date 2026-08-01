"use client";

import type { RuleCategory, RulePriority } from "@/types/dashboard";
import type {
  RecommendationItem,
  RecommendationPhase,
} from "@/types/analytics";
import { ACTION_CATEGORY_LABELS } from "@/features/action-board/use-action-board-data";

// --------------------------------------------------------------------------- //
// Filter model
// --------------------------------------------------------------------------- //

export type PriorityFilter = "all" | RulePriority;
export type CategoryFilter = "all" | RuleCategory;
export type PhaseFilter = "all" | RecommendationPhase;

export interface AnalyticsFilters {
  priority: PriorityFilter;
  category: CategoryFilter;
  phase: PhaseFilter;
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilters = {
  priority: "all",
  category: "all",
  phase: "all",
};

export const PRIORITY_FILTER_OPTIONS: PriorityFilter[] = [
  "all",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const PHASE_FILTER_OPTIONS: PhaseFilter[] = [
  "all",
  "Immediate",
  "Short-Term",
  "Medium-Term",
  "Long-Term",
];

export const CATEGORY_FILTER_OPTIONS: CategoryFilter[] = [
  "all",
  "immediate_actions",
  "high_priority",
  "medium_priority",
  "long_term",
  "risk_alerts",
  "compliance_actions",
  "export_readiness_actions",
  "digital_transformation_actions",
];

export function categoryLabel(key: CategoryFilter): string {
  if (key === "all") return "All categories";
  return ACTION_CATEGORY_LABELS[key] ?? key;
}

export function isFiltersActive(filters: AnalyticsFilters): boolean {
  return (
    filters.priority !== "all" ||
    filters.category !== "all" ||
    filters.phase !== "all"
  );
}

export function applyRecommendationFilters(
  items: RecommendationItem[],
  filters: AnalyticsFilters,
): RecommendationItem[] {
  return items.filter((item) => {
    if (filters.priority !== "all" && item.priority !== filters.priority) {
      return false;
    }
    if (filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    if (filters.phase !== "all" && item.phase !== filters.phase) {
      return false;
    }
    return true;
  });
}

export function countByPriority(items: RecommendationItem[]) {
  return {
    Critical: items.filter((i) => i.priority === "Critical").length,
    High: items.filter((i) => i.priority === "High").length,
    Medium: items.filter((i) => i.priority === "Medium").length,
    Low: items.filter((i) => i.priority === "Low").length,
  };
}

export function countByCategory(items: RecommendationItem[]) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const label = ACTION_CATEGORY_LABELS[item.category] ?? item.category;
    out[label] = (out[label] ?? 0) + 1;
  }
  return out;
}

export function sumRoi(items: RecommendationItem[]): number {
  return items.reduce((acc, i) => acc + i.estimated_roi, 0);
}

export function sumImpact(items: RecommendationItem[]): number {
  return items.reduce((acc, i) => acc + i.business_impact, 0);
}
