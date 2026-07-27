"use client";

import { useId } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type AnalyticsFilters,
  CATEGORY_FILTER_OPTIONS,
  categoryLabel,
  DEFAULT_ANALYTICS_FILTERS,
  isFiltersActive,
  PHASE_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
} from "./use-analytics-filters";

interface AnalyticsFiltersBarProps {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  filteredCount: number;
  totalCount: number;
  className?: string;
}

/**
 * Interactive filters for the analytics page — priority,
 * category, and phase. Pure presentation; parent owns state.
 */
export function AnalyticsFiltersBar({
  filters,
  onChange,
  filteredCount,
  totalCount,
  className,
}: AnalyticsFiltersBarProps) {
  const priorityId = useId();
  const categoryId = useId();
  const phaseId = useId();
  const active = isFiltersActive(filters);

  return (
    <div
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
            onClick={() => onChange(DEFAULT_ANALYTICS_FILTERS)}
          >
            <X className="size-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          id={priorityId}
          label="Priority"
          value={filters.priority}
          options={PRIORITY_FILTER_OPTIONS.map((v) => ({
            value: v,
            label: v === "all" ? "All priorities" : v,
          }))}
          onChange={(priority) =>
            onChange({ ...filters, priority: priority as AnalyticsFilters["priority"] })
          }
        />
        <FilterSelect
          id={categoryId}
          label="Category"
          value={filters.category}
          options={CATEGORY_FILTER_OPTIONS.map((v) => ({
            value: v,
            label: categoryLabel(v),
          }))}
          onChange={(category) =>
            onChange({ ...filters, category: category as AnalyticsFilters["category"] })
          }
        />
        <FilterSelect
          id={phaseId}
          label="Phase"
          value={filters.phase}
          options={PHASE_FILTER_OPTIONS.map((v) => ({
            value: v,
            label: v === "all" ? "All phases" : v,
          }))}
          onChange={(phase) =>
            onChange({ ...filters, phase: phase as AnalyticsFilters["phase"] })
          }
        />
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
