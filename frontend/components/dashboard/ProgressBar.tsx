"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  /** Optional label rendered above the bar. */
  label?: string;
  /** Optional secondary line (e.g. the band or a counter). */
  hint?: React.ReactNode;
  /** Tailwind classes for the track. */
  trackClassName?: string;
  /** Tailwind classes for the fill. */
  fillClassName?: string;
  /** Animate the bar from 0 to value. Default true. */
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Animated progress bar — used for readiness scores and
 * intelligence analyzer scores.
 *
 * The animation is a CSS transform on the inner fill, so it
 * composes cheaply and does not retrigger on every prop change.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  hint,
  trackClassName,
  fillClassName,
  animate = true,
  className,
  ariaLabel,
}: ProgressBarProps) {
  const safeMax = max <= 0 ? 100 : max;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const [shown, setShown] = useState(animate ? 0 : pct);

  useEffect(() => {
    if (!animate) {
      setShown(pct);
      return;
    }
    // Animate in on mount and on value change.
    const t = window.setTimeout(() => setShown(pct), 60);
    return () => window.clearTimeout(t);
  }, [pct, animate]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || hint) && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          {label && <span className="font-medium text-foreground">{label}</span>}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.round(value)}
        aria-label={ariaLabel ?? label}
        className={cn(
          "h-2 w-full overflow-hidden rounded-full bg-secondary",
          trackClassName,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-700 ease-out",
            fillClassName,
          )}
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}
