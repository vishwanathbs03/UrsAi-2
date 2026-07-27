"use client";

import { useId } from "react";
import { Check, Eraser, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type NotificationsFilters,
  CATEGORY_FILTER_OPTIONS,
  DEFAULT_NOTIFICATIONS_FILTERS,
  isFiltersActive,
  NOTIFICATION_CATEGORIES,
  PRIORITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from "./use-notification-filters";

interface NotificationsFiltersBarProps {
  filters: NotificationsFilters;
  onChange: (next: NotificationsFilters) => void;
  filteredCount: number;
  totalCount: number;
  unreadCount: number;
  onMarkAllRead: () => void;
  onClearRead: () => void;
  className?: string;
}

/**
 * Search + filter bar for the Notifications Center. Pure
 * presentation — parent owns the state. Reuses the same
 * visual rhythm as the analytics / insights / action-board
 * filter bars (border + soft shadow + flex-wrap) so the
 * page feels consistent with the rest of the app.
 *
 * The "Mark all as read" and "Clear read" buttons live on
 * the same surface so the user does not have to scroll
 * back to the page header to act.
 */
export function NotificationsFiltersBar({
  filters,
  onChange,
  filteredCount,
  totalCount,
  unreadCount,
  onMarkAllRead,
  onClearRead,
  className,
}: NotificationsFiltersBarProps) {
  const searchId = useId();
  const active = isFiltersActive(filters);

  return (
    <div
      role="search"
      aria-label="Filter notifications"
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
            {filteredCount} of {totalCount} notifications
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            aria-label="Mark all notifications as read"
          >
            <Check className="size-4" aria-hidden="true" />
            Mark all as read
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearRead}
            aria-label="Clear read notifications"
          >
            <Eraser className="size-4" aria-hidden="true" />
            Clear read
          </Button>
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(DEFAULT_NOTIFICATIONS_FILTERS)}
              aria-label="Clear all filters"
            >
              <X className="size-4" aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search notifications
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
          placeholder="Search titles, summaries, related rules…"
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
                : NOTIFICATION_CATEGORIES.find((x) => x.key === c)?.label ?? c,
          }))}
          onChange={(v) =>
            onChange({
              ...filters,
              category: v as NotificationsFilters["category"],
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
              priority: v as NotificationsFilters["priority"],
            })
          }
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_FILTER_OPTIONS.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          onChange={(v) =>
            onChange({
              ...filters,
              status: v as NotificationsFilters["status"],
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
