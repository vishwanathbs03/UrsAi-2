"use client";

import { useId } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type PredictiveFilters,
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_PREDICTIVE_FILTERS,
  isFiltersActive,
  PRIORITY_FILTER_OPTIONS,
  TIMELINE_OPTIONS,
} from "./use-predictive-filters";

interface PredictiveFiltersBarProps {
  filters: PredictiveFilters;
  onChange: (next: PredictiveFilters) => void;
  filteredCount: number;
  totalCount: number;
  className?: string;
}

/**
 * Search-free filter bar — three selects (Timeline,
 * Category, Priority) and a "Clear filters" button. The
 * "no search input" choice is intentional: every value the
 * spec calls out is a structured facet, not a free-text
 * query, and the only consumer of the filters is the
 * "What Drives Growth" recommendations list, which a
 * search box would not improve.
 */
export function PredictiveFiltersBar({
  filters,
  onChange,
  filteredCount,
  totalCount,
  className,
}: PredictiveFiltersBarProps) {
  const active = isFiltersActive(filters);

  return (
    <div
      role="search"
      aria-label="Filter predictive analytics"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          Filters
          <span className="text-xs font-normal text-muted-foreground">
            {filteredCount} of {totalCount} recommendations
          </span>
        </div>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_PREDICTIVE_FILTERS)}
            aria-label="Clear all filters"
          >
            <X className="size-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Timeline"
          value={filters.timeline}
          options={TIMELINE_OPTIONS}
          onChange={(v) =>
            onChange({
              ...filters,
              timeline: v as PredictiveFilters["timeline"],
            })
          }
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          options={CATEGORY_FILTER_OPTIONS.map((c) => ({
            value: c,
            label: c === "all" ? "All categories" : c,
          }))}
          onChange={(v) =>
            onChange({
              ...filters,
              category: v as PredictiveFilters["category"],
            })
          }
        />
        <FilterSelect
          label="Priority"
          value={filters.priority}
          options={PRIORITY_FILTER_OPTIONS.map((p) => ({
            value: p,
            label: p === "all" ? "All priorities" : p,
          }))}
          onChange={(v) =>
            onChange({
              ...filters,
              priority: v as PredictiveFilters["priority"],
            })
          }
        />
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const id = useId();
  return (
    <div className="flex min-w-[160px] flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
