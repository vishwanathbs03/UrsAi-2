"use client";

import { useId, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type InsightsFilters,
  CATEGORY_FILTER_OPTIONS,
  CONFIDENCE_FILTER_OPTIONS,
  DEFAULT_INSIGHTS_FILTERS,
  INSIGHT_CATEGORIES,
  isFiltersActive,
  PRIORITY_FILTER_OPTIONS,
} from "./use-insights-filters";

interface InsightsFiltersBarProps {
  filters: InsightsFilters;
  onChange: (next: InsightsFilters) => void;
  filteredCount: number;
  totalCount: number;
  className?: string;
}

/**
 * Search + filter bar for the Insights Center. Pure
 * presentation — parent owns the state. Reuses the same
 * visual rhythm as the analytics / action-board filter
 * bars (border + soft shadow + flex-wrap) so the page
 * feels consistent with the rest of the app.
 */
export function InsightsFiltersBar({
  filters,
  onChange,
  filteredCount,
  totalCount,
  className,
}: InsightsFiltersBarProps) {
  const searchId = useId();
  const active = isFiltersActive(filters);

  return (
    <div
      role="search"
      aria-label="Filter insights"
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
            {filteredCount} of {totalCount} insights
          </span>
        </div>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_INSIGHTS_FILTERS)}
            aria-label="Clear all filters"
          >
            <X className="size-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search insights
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Search titles, explanations, supporting rules…"
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Category"
          value={filters.category}
          options={CATEGORY_FILTER_OPTIONS.map((c) => ({
            value: c,
            label:
              c === "all"
                ? "All categories"
                : INSIGHT_CATEGORIES.find((x) => x.key === c)?.label ?? c,
          }))}
          onChange={(v) =>
            onChange({ ...filters, category: v as InsightsFilters["category"] })
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
            onChange({ ...filters, priority: v as InsightsFilters["priority"] })
          }
        />
        <FilterSelect
          label="Confidence"
          value={filters.confidence}
          options={CONFIDENCE_FILTER_OPTIONS.map((c) => ({
            value: c.value,
            label: c.label,
          }))}
          onChange={(v) =>
            onChange({
              ...filters,
              confidence: v as InsightsFilters["confidence"],
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
    <div className="flex min-w-[140px] flex-col gap-1">
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
