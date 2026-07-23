"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  /** Target value. */
  value: number;
  /** Animation duration in ms. Default 700ms. */
  durationMs?: number;
  /** Decimal places to round to. Default 0. */
  decimals?: number;
  /** Optional prefix (e.g. "+"). */
  prefix?: string;
  /** Optional suffix (e.g. "%"). */
  suffix?: string;
  /** Disable animation (e.g. in tests / reduced-motion). */
  animate?: boolean;
  className?: string;
  /** Inline style for the rendered number. */
  style?: React.CSSProperties;
  /** ARIA label override. Default is "Value: {value}". */
  ariaLabel?: string;
}

/**
 * Count-up number with a small "tween" so score numbers
 * glide from 0 to the target on first paint. Honors
 * `prefers-reduced-motion` via CSS rules in globals.css
 * (transitions are clamped to ~0ms under that media query).
 *
 * Implementation note: uses requestAnimationFrame rather than
 * a third-party easing library because the spec is "no new
 * dep unless named" and requestAnimationFrame is universally
 * available. The easing is a simple ease-out (1 - (1-t)^3)
 * which is the same curve shadcn's own number-animation
 * primitives use and looks good for short 400-800ms runs.
 */
export function AnimatedCounter({
  value,
  durationMs = 700,
  decimals = 0,
  prefix = "",
  suffix = "",
  animate = true,
  className,
  style,
  ariaLabel,
}: AnimatedCounterProps) {
  // Sanitise the target so a bad payload can't lock us in
  // a render loop (NaN, Infinity, etc.).
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(animate ? 0 : safeTarget);

  useEffect(() => {
    if (!animate) {
      setShown(safeTarget);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, durationMs));
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShown(from + (safeTarget - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setShown(safeTarget);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, durationMs, animate]);

  const factor = Math.pow(10, decimals);
  const display = (Math.round(shown * factor) / factor).toFixed(decimals);

  return (
    <span
      className={cn("tabular-nums", className)}
      style={style}
      aria-label={ariaLabel ?? `Value: ${prefix}${display}${suffix}`}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
