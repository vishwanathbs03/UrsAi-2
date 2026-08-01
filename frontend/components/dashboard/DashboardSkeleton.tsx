"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton block — used while dashboard data is loading. The
 * `animate-pulse` class is Tailwind's built-in keyframe so the
 * skeleton does not need its own animation.
 */
export function DashboardSkeleton({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="h-3 w-24 animate-pulse rounded-full bg-secondary" />
      <div className="h-5 w-3/4 animate-pulse rounded-md bg-secondary" />
      <div className="mt-1 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-full bg-secondary"
            style={{ width: `${60 + ((i * 9) % 30)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
