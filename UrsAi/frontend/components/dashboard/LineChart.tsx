"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface LineChartSeries {
  /** Legend label. */
  label: string;
  /** Y values aligned with `labels`. */
  values: number[];
  /** CSS color for the line and dots. */
  color?: string;
  /** Render as dashed line. */
  dashed?: boolean;
}

interface LineChartProps {
  /** X-axis labels. */
  labels: string[];
  series: LineChartSeries[];
  max?: number;
  size?: { width: number; height: number };
  className?: string;
  ariaLabel?: string;
}

/**
 * Lightweight SVG line chart — no external chart library.
 * Used for business score trend placeholders on the analytics page.
 */
export function LineChart({
  labels,
  series,
  max = 100,
  size = { width: 480, height: 200 },
  className,
  ariaLabel = "Line chart",
}: LineChartProps) {
  const id = useId();
  const { width, height } = size;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const count = Math.max(labels.length, 1);

  const xAt = (i: number) => pad.left + (i / Math.max(count - 1, 1)) * plotW;
  const yAt = (v: number) => {
    const clamped = Math.max(0, Math.min(max, v));
    return pad.top + plotH - (clamped / max) * plotH;
  };

  const gridLines = 4;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full max-w-full", className)}
    >
      {/* Horizontal grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = pad.top + (plotH * i) / gridLines;
        const val = Math.round(max - (max * i) / gridLines);
        return (
          <g key={`${id}-grid-${i}`}>
            <line
              x1={pad.left}
              y1={y}
              x2={width - pad.right}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((label, i) => (
        <text
          key={`${id}-x-${i}`}
          x={xAt(i)}
          y={height - 8}
          textAnchor="middle"
          className="fill-muted-foreground text-[9px]"
        >
          {label}
        </text>
      ))}

      {/* Series lines */}
      {series.map((s, sIdx) => {
        const color = s.color ?? "hsl(var(--primary))";
        const points = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
        const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        return (
          <g key={`${id}-series-${sIdx}`}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "6 4" : undefined}
            />
            {points.map((p, i) => (
              <circle
                key={`${id}-pt-${sIdx}-${i}`}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={color}
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
