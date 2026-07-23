"use client";

import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: string;
  /** Tailwind classes for the badge tone (bg + text). */
  tone: string;
  className?: string;
}

/**
 * Tiny pill that colour-codes a level (Low/Medium/High/...).
 * Centralised so the colour palette stays consistent across
 * the dashboard.
 */
export function LevelBadge({ level, tone, className }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
        className,
      )}
    >
      {level}
    </span>
  );
}
