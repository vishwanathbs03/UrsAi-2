"use client";

import { cn } from "@/lib/utils";

export type StatusBadgeTone = "ok" | "warn" | "down" | "neutral";

interface StatusBadgeProps {
  /** Visual tone. Drives the dot + label colour. */
  status: StatusBadgeTone;
  /** Optional label override. Defaults to the tone label. */
  label?: string;
  /** Show or hide the leading dot. Default true. */
  showDot?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<StatusBadgeTone, { wrap: string; dot: string }> = {
  ok: {
    wrap: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  warn: {
    wrap: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  down: {
    wrap: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  neutral: {
    wrap: "border-border bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

const TONE_LABELS: Record<StatusBadgeTone, string> = {
  ok: "OK",
  warn: "Warning",
  down: "Down",
  neutral: "Unknown",
};

/**
 * Inline status pill — green / amber / red / neutral.
 *
 * Used by the `/admin/system` page and any future module that needs
 * to surface a "is this subsystem healthy?" badge. The component is
 * intentionally light (no icon, no animation) so it fits inside the
 * existing dashboard card layouts without adding a new visual
 * rhythm.
 */
export function StatusBadge({
  status,
  label,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const tone = TONE_CLASSES[status];
  return (
    <span
      role="status"
      aria-label={label ?? TONE_LABELS[status]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone.wrap,
        className,
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", tone.dot)}
        />
      )}
      {label ?? TONE_LABELS[status]}
    </span>
  );
}
