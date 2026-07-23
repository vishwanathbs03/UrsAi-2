"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";

export type TrendDirection = "up" | "down" | "stable";

interface TrendBadgeProps {
  direction: TrendDirection;
  /** Optional label, e.g. "+3.2%". When omitted, just shows an icon. */
  label?: string;
  /** Tailwind utility classes that override the badge tone. */
  toneClassName?: string;
  className?: string;
  /** ARIA label override; otherwise the badge is announced by its
   *  visible text only. */
  ariaLabel?: string;
}

const META: Record<
  TrendDirection,
  { icon: LucideIcon; defaultTone: string; srLabel: string }
> = {
  up: {
    icon: ArrowUp,
    defaultTone: "bg-emerald-100 text-emerald-700",
    srLabel: "Improving",
  },
  stable: {
    icon: ArrowRight,
    defaultTone: "bg-sky-100 text-sky-700",
    srLabel: "Stable",
  },
  down: {
    icon: ArrowDown,
    defaultTone: "bg-rose-100 text-rose-700",
    srLabel: "Declining",
  },
};

/**
 * Tiny badge that shows a trend direction (up / stable / down).
 * Used as a placeholder for the "Trend" indicator on the
 * dashboard's score cards. The direction is currently
 * statically "stable" because the spec calls for a placeholder,
 * but the prop is exposed so a future milestone can wire it to
 * a real historical-comparison service without changing the
 * consuming card.
 */
export function TrendBadge({
  direction,
  label,
  toneClassName,
  className,
  ariaLabel,
}: TrendBadgeProps) {
  const meta = META[direction];
  const Icon = meta.icon;
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? meta.srLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        toneClassName ?? meta.defaultTone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label ?? meta.srLabel}
    </span>
  );
}
