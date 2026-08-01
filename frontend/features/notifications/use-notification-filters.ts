"use client";

import type { RulePriority } from "@/types/dashboard";

// --------------------------------------------------------------------------- //
// Spec categories
// --------------------------------------------------------------------------- //

/**
 * The nine notification categories the spec requires.
 *
 * Each notification has exactly one category. The category is
 * derived deterministically from the upstream payload that
 * produced the notification (see use-notifications-data.ts
 * `buildNotifications`):
 *
 *   Critical      -> highest-priority rule firings (Critical)
 *   High          -> high-priority rule firings
 *   Medium        -> medium-priority rule firings
 *   Low           -> low-priority rule firings
 *   Recommendation -> recommendation items not already covered
 *                    by a critical rule firing
 *   Roadmap       -> roadmap item updates (phase / progress)
 *   Risk          -> Digital Twin risk-overview signals
 *   Opportunity   -> Digital Twin opportunity / growth signals
 *   System        -> analysis-state events ("profile analysed",
 *                    "twin refreshed", etc.)
 *
 * The `source_key` on every notification points back to the
 * upstream payload field that produced it, so the join is
 * traceable end-to-end (see multi-milestone skill: "build
 * on top" / "source_key tracing").
 */
export type NotificationCategoryKey =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "recommendation"
  | "roadmap"
  | "risk"
  | "opportunity"
  | "system";

export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategoryKey;
  label: string;
  description: string;
}[] = [
  {
    key: "critical",
    label: "Critical",
    description: "Highest-priority rule firings that need immediate action.",
  },
  {
    key: "high",
    label: "High",
    description: "High-priority rule firings the engine is watching.",
  },
  {
    key: "medium",
    label: "Medium",
    description: "Medium-priority rule firings worth scheduling.",
  },
  {
    key: "low",
    label: "Low",
    description: "Low-priority firings and nice-to-have improvements.",
  },
  {
    key: "recommendation",
    label: "Recommendation",
    description: "New or updated recommendations from the engine.",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    description: "Roadmap item updates, phase changes, and progress.",
  },
  {
    key: "risk",
    label: "Risk",
    description: "Open risks surfaced by the Digital Twin.",
  },
  {
    key: "opportunity",
    label: "Opportunity",
    description: "Growth and opportunity signals from the Digital Twin.",
  },
  {
    key: "system",
    label: "System",
    description: "Profile / analysis / engine state events.",
  },
];

// --------------------------------------------------------------------------- //
// Filter model
// --------------------------------------------------------------------------- //

export type CategoryFilter = "all" | NotificationCategoryKey;
export type PriorityFilter = "all" | RulePriority;
export type StatusFilter = "all" | "unread" | "read";

export interface NotificationsFilters {
  query: string;
  category: CategoryFilter;
  priority: PriorityFilter;
  status: StatusFilter;
}

export const DEFAULT_NOTIFICATIONS_FILTERS: NotificationsFilters = {
  query: "",
  category: "all",
  priority: "all",
  status: "all",
};

export const CATEGORY_FILTER_OPTIONS: CategoryFilter[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "recommendation",
  "roadmap",
  "risk",
  "opportunity",
  "system",
];

export const PRIORITY_FILTER_OPTIONS: PriorityFilter[] = [
  "all",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const STATUS_FILTER_OPTIONS: {
  value: StatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "unread", label: "Unread only" },
  { value: "read", label: "Read only" },
];

export function isFiltersActive(filters: NotificationsFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.category !== "all" ||
    filters.priority !== "all" ||
    filters.status !== "all"
  );
}

// --------------------------------------------------------------------------- //
// Apply filters (pure)
// --------------------------------------------------------------------------- //

import type { NotificationItem } from "./use-notifications-data";

export function applyNotificationFilters(
  items: NotificationItem[],
  filters: NotificationsFilters,
  isRead: (id: string) => boolean,
): NotificationItem[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.category !== "all" && it.category !== filters.category) {
      return false;
    }
    if (filters.priority !== "all" && it.priority !== filters.priority) {
      return false;
    }
    if (filters.status !== "all") {
      const read = isRead(it.id);
      if (filters.status === "read" && !read) return false;
      if (filters.status === "unread" && read) return false;
    }
    if (q) {
      const hay = [
        it.title,
        it.summary,
        it.category,
        it.priority,
        it.relatedRecommendation?.title ?? "",
        it.relatedRoadmapItem?.title ?? "",
        it.relatedRule?.title ?? "",
        ...(it.relatedRule?.source_keys ?? []),
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
  items: NotificationItem[],
): Record<NotificationCategoryKey, number> {
  const out: Record<NotificationCategoryKey, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    recommendation: 0,
    roadmap: 0,
    risk: 0,
    opportunity: 0,
    system: 0,
  };
  for (const it of items) {
    out[it.category] = (out[it.category] ?? 0) + 1;
  }
  return out;
}
