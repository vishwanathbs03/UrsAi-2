"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional small label rendered above the title. */
  badge?: string;
  /** Optional title element. If provided, renders a heading. */
  title?: string;
  /** Optional caption / sub-label next to the title. */
  caption?: string;
  /** Right-aligned slot (e.g. a refresh button, timestamp). */
  trailing?: React.ReactNode;
  /** Animate the card in (fade + lift). Default true. */
  animate?: boolean;
  /** Tighten padding — useful for the smaller cards. */
  compact?: boolean;
}

/**
 * Shared card surface used by every dashboard widget.
 *
 * Centralises:
 *  * the visual rhythm (border, radius, padding, shadow)
 *  * the entry animation (fade + lift on first mount)
 *  * the title / badge / trailing-slot layout
 */
export const DashboardCard = forwardRef<HTMLDivElement, DashboardCardProps>(
  function DashboardCard(
    {
      badge,
      title,
      caption,
      trailing,
      animate = true,
      compact = false,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-soft",
          compact && "gap-3 p-4",
          animate && "animate-fadeUp",
          className,
        )}
        {...rest}
      >
        {(badge || title || trailing) && (
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              {badge && (
                <span className="inline-flex w-fit items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {badge}
                </span>
              )}
              {title && (
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {title}
                </h3>
              )}
              {caption && (
                <p className="text-xs text-muted-foreground">{caption}</p>
              )}
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
          </div>
        )}
        {children}
      </div>
    );
  },
);
