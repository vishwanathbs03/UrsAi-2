"use client";

/**
 * Barrel for the Action Board feature module. Consumers
 * import the view via `@/features/action-board`.
 *
 * Named exports:
 *  - `ActionBoardView` — the top-level page composition
 *  - `useActionBoardData` — the data hook (rules + AI join)
 *  - `useActionStatusStorage` — the localStorage hook
 *  - `useActionBoardFilters` — pure helpers (filters + sort)
 *  - `BoardControls` — search / filter / sort bar
 *  - `BoardSummaryPanel` — progress / impact / lift panel
 *  - `BusinessJourneyPreview` — current vs projected DNA
 *  - `ActionDetailsPanel` — slide-over body
 *  - `ACTION_STATUS_VALUES`, `STATUS_LABELS` — for consumers
 *    that want to render their own column pickers
 */

export { ActionBoardView } from "./ActionBoardView";
export { useActionBoardData } from "./use-action-board-data";
export { useRulesQuery, useDecisionQuery } from "./use-action-board-data";
export type {
  ActionBoardData,
  ActionBoardDataState,
  ActionCardItem,
  Difficulty,
  UseActionBoardDataResult,
} from "./use-action-board-data";

export {
  useActionStatusStorage,
  ACTION_STATUS_VALUES,
  STATUS_LABELS,
} from "./use-action-status-storage";
export type { ActionStatus } from "./use-action-status-storage";

export {
  applyFilters,
  applySort,
  DEFAULT_BOARD_FILTERS,
  PRIORITY_FILTER_OPTIONS,
  DIFFICULTY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  SORT_OPTIONS,
  priorityWeight,
  effortWeeks,
} from "./use-action-board-filters";
export type {
  BoardFilters,
  PriorityFilter,
  CategoryFilter,
  DifficultyFilter,
  StatusFilter,
  SortKey,
  SortDirection,
} from "./use-action-board-filters";

export { BoardControls } from "./BoardControls";
export { BoardSummaryPanel } from "./BoardSummaryPanel";
export { BusinessJourneyPreview } from "./BusinessJourneyPreview";
export { ActionDetailsPanel } from "./ActionDetailsPanel";
