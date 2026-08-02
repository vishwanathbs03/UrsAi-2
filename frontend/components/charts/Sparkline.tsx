"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** Y-axis series. */
  values: number[];
  /** 0..max. Default 100. */
  max?: number;
  size?: { width: number; height: number };
  /** CSS stroke color. */
  color?: string;
  /** Filled area underneath the line. */
  fill?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Lightweight SVG sparkline for executive KPI ribbons.
 * - Animates the line from start to current value when first painted.
 * - Hover reveals a focus dot + tooltip showing value at that index.
 * - No external dependencies; uses prefers-reduced-motion via globals.css.
 */
export function Sparkline({
  values,
  max = 100,
  size = { width: 140, height: 38 },
  color = "hsl(var(--primary))",
  fill = true,
  className,
  ariaLabel = "Sparkline trend",
}: SparklineProps) {
  const id = useId();
  const safe = values.length === 0 ? [0] : values;
  const [hover, setHover] = useState<number | null>(null);
  const { width, height } = size;
  const padX = 2;
  const padY = 4;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const maxVal = Math.max(max, ...safe, 1);
  const minVal = Math.min(0, ...safe);
  const range = Math.max(1, maxVal - minVal);

  const xAt = (i: number) =>
    padX + (i / Math.max(safe.length - 1, 1)) * plotW;
  const yAt = (v: number) =>
    padY + plotH - ((v - minVal) / range) * plotH;

  const points = safe.map((v, i) => ({ x: xAt(i), y: yAt(v), v }));
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    padY + plotH
  } L ${points[0].x} ${padY + plotH} Z`;
  const gradId = `${id}-spk-grad`;
  const hoverSafe = hover !== null && hover >= 0 && hover < points.length ? hover : null;
  const hoverPoint = hoverSafe !== null ? points[hoverSafe] : null;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full max-w-full", className)}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const rel = (e.clientX - rect.left) / rect.width;
        const idx = Math.round(rel * (safe.length - 1));
        setHover(Math.min(safe.length - 1, Math.max(0, idx)));
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={areaPath}
          fill={`url(#${gradId})`}
          style={{ transition: "all 300ms ease" }}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 220,
          strokeDashoffset: 0,
          animation: "exec-spark 1.1s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      />
      {points.map((p, i) => (
        <circle
          key={`${id}-pt-${i}`}
          cx={p.x}
          cy={p.y}
          r={i === hoverSafe ? 3 : 0}
          fill={color}
          stroke="hsl(var(--background))"
          strokeWidth={1}
          style={{ transition: "r 120ms ease" }}
        />
      ))}
      {hoverPoint && (
        <g pointerEvents="none">
          <line
            x1={hoverPoint.x}
            x2={hoverPoint.x}
            y1={padY}
            y2={padY + plotH}
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          <text
            x={hoverPoint.x}
            y={Math.max(8, hoverPoint.y - 6)}
            textAnchor="middle"
            className="fill-foreground"
            style={{
              fontSize: 10,
              fontWeight: 600,
              paintOrder: "stroke",
              stroke: "hsl(var(--background))",
              strokeWidth: 3,
            }}
          >
            {Math.round(hoverPoint.v)}
          </text>
        </g>
      )}
    </svg>
  );
}
