"use client";

import type { ActionCardItem } from "./use-action-board-data";
import type { ActionStatus } from "./use-action-status-storage";

export type { ActionCardItem } from "./use-action-board-data";
export type { ActionStatus } from "./use-action-status-storage";

// --------------------------------------------------------------------------- //
// Filter / sort model
// --------------------------------------------------------------------------- //

/** Priority filter values — "all" + the four rule-engine
 *  priorities. Type narrowed to keep the select option list
 *  a single source of truth. */
export type PriorityFilter =
  | "all"
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

/** Category filter — the key from the rule engine, or "all". */
export type CategoryFilter =
  | "all"
  | (typeof import("./use-action-board-data").ACTION_CATEGORY_LABELS)[keyof typeof import("./use-action-board-data").ACTION_CATEGORY_LABELS] extends string
    ? string
    : never;

/** Difficulty filter values. */
export type DifficultyFilter = "all" | "Easy" | "Moderate" | "Hard" | "Expert";

/** Status filter values — "all" + the three Kanban columns. */
export type StatusFilter = "all" | ActionStatus;

/** Sort key. "effort" sorts by estimated time (shortest
 *  first); "impact" by estimated_impact; "roi" by derived
 *  ROI; "priority" by the rule-engine priority weight. */
export type SortKey = "impact" | "roi" | "priority" | "effort";
export type SortDirection = "asc" | "desc";

export interface BoardFilters {
  query: string;
  priority: PriorityFilter;
  category: string;
  difficulty: DifficultyFilter;
  status: StatusFilter;
  sort: SortKey;
  direction: SortDirection;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  query: "",
  priority: "all",
  category: "all",
  difficulty: "all",
  status: "all",
  sort: "priority",
  direction: "asc",
};

export const PRIORITY_FILTER_OPTIONS: PriorityFilter[] = [
  "all",
  "Critical",
  "High",
  "Medium",
  "Low",
];

export const DIFFICULTY_FILTER_OPTIONS: DifficultyFilter[] = [
  "all",
  "Easy",
  "Moderate",
  "Hard",
  "Expert",
];

export const STATUS_FILTER_OPTIONS: StatusFilter[] = [
  "all",
  "todo",
  "in_progress",
  "completed",
];

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "impact", label: "Impact" },
  { key: "roi", label: "ROI" },
  { key: "priority", label: "Priority" },
  { key: "effort", label: "Effort" },
];

// --------------------------------------------------------------------------- //
// Priority ordering for sort/filter.
// --------------------------------------------------------------------------- //

/**
 * Higher = more urgent. Mirrors the weight used in the
 * scoring/ROI derivations; pinned here as a single source
 * of truth.
 */
export function priorityWeight(p: ActionCardItem["priority"]): number {
  return p === "Critical" ? 4 : p === "High" ? 3 : p === "Medium" ? 2 : 1;
}

/**
 * Estimated effort in "weeks" — used to sort by effort.
 * Parses the friendly `estimatedTime` string back to a
 * numeric range. Falls back to 0 if unparseable.
 */
export function effortWeeks(card: ActionCardItem): number {
  const t = card.estimatedTime;
  if (t.startsWith("~1 week")) return 1;
  const m = t.match(/~(\d+)\s+weeks/);
  if (m) return parseInt(m[1], 10);
  if (t.startsWith("~1 month")) return 4;
  const mm = t.match(/~(\d+)\s+months/);
  if (mm) return parseInt(mm[1], 10) * 4;
  return 0;
}

// --------------------------------------------------------------------------- //
// Filter / sort application.
// Pure functions — the parent owns the state, the bar
// owns the input controls, the panel owns the apply step.
// --------------------------------------------------------------------------- //

export function applyFilters(
  cards: ActionCardItem[],
  filters: BoardFilters,
  resolveStatus: (id: string) => ActionStatus,
): ActionCardItem[] {
  const q = filters.query.trim().toLowerCase();
  return cards.filter((c) => {
    if (filters.priority !== "all" && c.priority !== filters.priority) {
      return false;
    }
    if (filters.category !== "all" && c.categoryKey !== filters.category) {
      return false;
    }
    if (filters.difficulty !== "all" && c.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.status !== "all" && resolveStatus(c.id) !== filters.status) {
      return false;
    }
    if (q) {
      const hay = [
        c.title,
        c.category,
        c.priority,
        c.difficulty,
        c.estimatedTime,
        c.aiExplanation,
        ...c.sourceKeys,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function applySort(
  cards: ActionCardItem[],
  key: SortKey,
  direction: SortDirection,
): ActionCardItem[] {
  const sign = direction === "asc" ? 1 : -1;
  const sorted = [...cards];
  sorted.sort((a, b) => {
    let diff = 0;
    if (key === "impact") {
      diff = a.estimatedBusinessImpact - b.estimatedBusinessImpact;
    } else if (key === "roi") {
      diff = a.estimatedRoi - b.estimatedRoi;
    } else if (key === "priority") {
      diff = priorityWeight(a.priority) - priorityWeight(b.priority);
    } else if (key === "effort") {
      diff = effortWeeks(a) - effortWeeks(b);
    }
    // Stable tiebreaker: higher impact first, then alpha.
    if (diff === 0) diff = b.estimatedBusinessImpact - a.estimatedBusinessImpact;
    if (diff === 0) diff = a.title.localeCompare(b.title);
    return diff * sign;
  });
  return sorted;
}
