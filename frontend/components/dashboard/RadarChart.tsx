"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface RadarDatum {
  /** Axis label, e.g. "Export". */
  axis: string;
  /** Raw 0..100 value. */
  value: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  /** Max value for the scale. Default 100. */
  max?: number;
  /** Number of concentric grid rings. Default 4. */
  rings?: number;
  /** Override the chart's pixel size. */
  size?: number;
  className?: string;
  /** Optional primary color (CSS color string). */
  color?: string;
  /** Optional fill color (defaults to primary with low alpha). */
  fillColor?: string;
  ariaLabel?: string;
}

/**
 * Lightweight SVG radar chart — no chart library dependency.
 *
 * Why hand-rolled: the dashboard only needs one radar, the data
 * is tiny (≤ 8 axes), and pulling in recharts / chart.js for a
 * single primitive is over-scoping. The math is plain trigonometry
 * and the result is fully styleable with Tailwind utility classes
 * via `className`.
 */
export function RadarChart({
  data,
  max = 100,
  rings = 4,
  size = 280,
  className,
  color = "hsl(var(--primary))",
  fillColor,
  ariaLabel = "Radar chart",
}: RadarChartProps) {
  const id = useId();
  const fill = fillColor ?? "hsla(var(--primary), 0.18)";
  const safe = data.length >= 3 ? data : padAxes(data, 3);

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.78; // leave room for labels
  const labelInset = 14;
  const axes = safe.length;

  // Build polygon points for the data shape.
  const dataPoints = safe.map((d, i) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = clamp01(d.value / max) * radius;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      labelX: cx + Math.cos(angle) * (radius + labelInset),
      labelY: cy + Math.sin(angle) * (radius + labelInset),
      axis: d.axis,
      value: d.value,
    };
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("h-auto w-full max-w-full", className)}
    >
      {/* Concentric grid rings */}
      <g>
        {Array.from({ length: rings }).map((_, rIdx) => {
          const r = (radius * (rIdx + 1)) / rings;
          const pts = Array.from({ length: axes }).map((_, i) => {
            const a = (Math.PI * 2 * i) / axes - Math.PI / 2;
            return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
          }).join(" ");
          return (
            <polygon
              key={`${id}-ring-${rIdx}`}
              points={pts}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={1}
            />
          );
        })}
      </g>

      {/* Axis spokes */}
      <g>
        {dataPoints.map((p, i) => (
          <line
            key={`${id}-spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos((Math.PI * 2 * i) / axes - Math.PI / 2) * radius}
            y2={cy + Math.sin((Math.PI * 2 * i) / axes - Math.PI / 2) * radius}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* Filled data polygon */}
      <polygon
        points={polygonPoints}
        fill={fill}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points */}
      <g>
        {dataPoints.map((p, i) => (
          <circle
            key={`${id}-pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={color}
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
          />
        ))}
      </g>

      {/* Axis labels */}
      <g>
        {dataPoints.map((p, i) => (
          <text
            key={`${id}-label-${i}`}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-medium"
          >
            {truncate(p.axis, 14)}
          </text>
        ))}
      </g>
    </svg>
  );
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function padAxes(data: RadarDatum[], n: number): RadarDatum[] {
  if (data.length >= n) return data;
  const out = [...data];
  while (out.length < n) out.push({ axis: "", value: 0 });
  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
