"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CircularScoreProps {
  /** 0..100. */
  value: number;
  /** Ring thickness in pixels. */
  thickness?: number;
  /** Pixel size. */
  size?: number;
  /** Optional small label below the number. */
  caption?: string;
  /** Override the ring track color. */
  trackClassName?: string;
  /** Override the ring progress color. */
  fillClassName?: string;
  /** Animate from 0. Default true. */
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Circular score indicator — used on the Overall Health card
 * and per-pillar hero numbers.
 *
 * The arc length is driven by the `strokeDasharray` on a circle
 * whose circumference equals 2πr. Animation is a CSS transition
 * on `strokeDashoffset` so it composites cheaply.
 */
export function CircularScore({
  value,
  thickness = 10,
  size = 140,
  caption,
  trackClassName,
  fillClassName,
  animate = true,
  className,
  ariaLabel,
}: CircularScoreProps) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = (safeValue / 100) * circumference;
  const [shown, setShown] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      setShown(target);
      return;
    }
    const t = window.setTimeout(() => setShown(target), 60);
    return () => window.clearTimeout(t);
  }, [target, animate]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        role="img"
        aria-label={ariaLabel ?? `Score ${Math.round(safeValue)}`}
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={cn("stroke-secondary", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - shown}
          className={cn(
            "stroke-primary transition-[stroke-dashoffset] duration-700 ease-out",
            fillClassName,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {Math.round(safeValue)}
        </span>
        {caption && (
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
