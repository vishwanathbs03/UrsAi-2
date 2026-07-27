"use client";

import type { RuleCategory, RulePriority } from "@/types/dashboard";
import type { RecommendationItem } from "@/types/analytics";

// --------------------------------------------------------------------------- //
// Filter model
// --------------------------------------------------------------------------- //

/**
 * Timeline filter — selects which future projection points
 * the growth chart renders. "all" shows Current + 3/6/12;
 * the named values hide the others and emphasise the
 * chosen point.
 */
export type TimelineFilter = "all" | "3m" | "6m" | "12m";
export type CategoryFilter = "all" | RuleCategory;
export type PriorityFilter = "all" | RulePriority;

export interface PredictiveFilters {
  timeline: TimelineFilter;
  category: CategoryFilter;
  priority: PriorityFilter;
}

export const DEFAULT_PREDICTIVE_FILTERS: PredictiveFilters = {
  timeline: "all",
  category: "all",
  priority: "all",
};

export const TIMELINE_FILTER_OPTIONS: TimelineFilter[] = [
  "all",
  "3m",
  "6m",
  "12m",
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

export const PRIORITY_FILTER_OPTIONS: PriorityFilter[] = [
  "all",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export function isFiltersActive(filters: PredictiveFilters): boolean {
  return (
    filters.timeline !== "all" ||
    filters.category !== "all" ||
    filters.priority !== "all"
  );
}

// --------------------------------------------------------------------------- //
// Timeline labels (single source of truth for the 4 x-axis points)
// --------------------------------------------------------------------------- //

export const TIMELINE_LABELS = ["Current", "3 Months", "6 Months", "12 Months"] as const;
export type TimelineKey = "current" | "three_month" | "six_month" | "twelve_month";

export const TIMELINE_OPTIONS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All timelines" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
];

export const TIMELINE_TAB_OPTIONS: { value: TimelineKey; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "three_month", label: "3 Months" },
  { value: "six_month", label: "6 Months" },
  { value: "twelve_month", label: "12 Months" },
];

// --------------------------------------------------------------------------- //
// Pure apply filters
// --------------------------------------------------------------------------- //

/**
 * Apply the user-selected filters to the recommendation
 * list. Category and priority are pure 1:1 matches against
 * the upstream RecommendationItem fields; the timeline
 * filter is irrelevant for a per-recommendation list and
 * is therefore ignored here (the timeline filter only
 * affects the Growth Forecast series, not the rec list).
 */
export function applyPredictiveFilters(
  items: RecommendationItem[],
  filters: PredictiveFilters,
): RecommendationItem[] {
  return items.filter((it) => {
    if (filters.category !== "all" && it.category !== filters.category) {
      return false;
    }
    if (filters.priority !== "all" && it.priority !== filters.priority) {
      return false;
    }
    return true;
  });
}
