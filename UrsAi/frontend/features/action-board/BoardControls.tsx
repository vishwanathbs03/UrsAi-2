"use client";

import { useId, useMemo } from "react";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Filter,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ACTION_CATEGORY_LABELS } from "./use-action-board-data";
import {
  type BoardFilters,
  DIFFICULTY_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type SortKey,
} from "./use-action-board-filters";

interface BoardControlsProps {
  filters: BoardFilters;
  onChange: (next: BoardFilters) => void;
  /** All distinct category keys present in the current
   *  card list, in deterministic order, used to populate
   *  the category select. */
  availableCategories: string[];
  /** True when any filter is non-default — used to decide
   *  whether the "Clear" button is visible. */
  isFiltered: boolean;
  /** Total cards in the board (pre-filter) and visible cards
   *  (post-filter) so the bar can show a small "X of Y" hint. */
  totalCards: number;
  visibleCards: number;
}

const PRIORITY_LABELS: Record<string, string> = {
  all: "All priorities",
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  all: "All difficulties",
  Easy: "Easy",
  Moderate: "Moderate",
  Hard: "Hard",
  Expert: "Expert",
};

const STATUS_LABELS: Record<string, string> = {
  all: "All statuses",
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

const SORT_LABELS: Record<SortKey, string> = {
  impact: "Impact",
  roi: "ROI",
  priority: "Priority",
  effort: "Effort",
};

/**
 * Search / filter / sort bar for the Action Board.
 *
 * Pure presentation — owns no state. The parent passes the
 * current filters and an `onChange` callback. The bar
 * surfaces every control on a single line on desktop, and
 * wraps onto a second line on mobile.
 *
 * Accessibility:
 *  - The search input has an aria-label
 *  - Each select has a paired visually-hidden label
 *  - The "Clear" button is a normal button, focusable and
 *    operable by keyboard.
 */
export function BoardControls({
  filters,
  onChange,
  availableCategories,
  isFiltered,
  totalCards,
  visibleCards,
}: BoardControlsProps) {
  const searchId = useId();
  const sortDir = filters.direction;

  const categoryOptions = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(availableCategories)).sort((a, b) => {
        const la = ACTION_CATEGORY_LABELS[a] ?? a;
        const lb = ACTION_CATEGORY_LABELS[b] ?? b;
        return la.localeCompare(lb);
      }),
    ];
  }, [availableCategories]);

  function patch(partial: Partial<BoardFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div
      role="search"
      aria-label="Filter and sort actions"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-soft md:flex-row md:flex-wrap md:items-center"
    >
      <div className="relative flex-1 md:min-w-[12rem]">
        <label htmlFor={searchId} className="sr-only">
          Search actions
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="Search actions, categories, sources…"
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label="Search actions"
        />
      </div>

      <Select
        label="Priority"
        value={filters.priority}
        onChange={(v) => patch({ priority: v as BoardFilters["priority"] })}
        options={PRIORITY_FILTER_OPTIONS.map((p) => ({
          value: p,
          label: PRIORITY_LABELS[p] ?? p,
        }))}
      />
      <Select
        label="Category"
        value={filters.category}
        onChange={(v) => patch({ category: v })}
        options={categoryOptions.map((c) => ({
          value: c,
          label: c === "all" ? "All categories" : ACTION_CATEGORY_LABELS[c] ?? c,
        }))}
      />
      <Select
        label="Difficulty"
        value={filters.difficulty}
        onChange={(v) => patch({ difficulty: v as BoardFilters["difficulty"] })}
        options={DIFFICULTY_FILTER_OPTIONS.map((d) => ({
          value: d,
          label: DIFFICULTY_LABELS[d] ?? d,
        }))}
      />
      <Select
        label="Status"
        value={filters.status}
        onChange={(v) => patch({ status: v as BoardFilters["status"] })}
        options={STATUS_FILTER_OPTIONS.map((s) => ({
          value: s,
          label: STATUS_LABELS[s] ?? s,
        }))}
      />

      <div className="flex items-center gap-1 md:ml-auto">
        <Select
          label="Sort by"
          value={filters.sort}
          onChange={(v) => patch({ sort: v as SortKey })}
          options={SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() =>
            patch({ direction: sortDir === "asc" ? "desc" : "asc" })
          }
          aria-label={`Sort direction: ${sortDir === "asc" ? "ascending" : "descending"} (click to toggle)`}
          title={`Sort ${SORT_LABELS[filters.sort]} ${
            sortDir === "asc" ? "ascending" : "descending"
          } — click to toggle`}
        >
          {sortDir === "asc" ? (
            <ArrowUpNarrowWide className="size-4" aria-hidden="true" />
          ) : (
            <ArrowDownNarrowWide className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 md:ml-2">
        <span
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          aria-live="polite"
        >
          <Filter className="size-3" aria-hidden="true" />
          {visibleCards} of {totalCards}
        </span>
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                query: "",
                priority: "all",
                category: "all",
                difficulty: "all",
                status: "all",
                sort: filters.sort,
                direction: filters.direction,
              })
            }
            aria-label="Clear all filters"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
