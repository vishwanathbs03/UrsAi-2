"use client";

import React, { useId } from "react";

export interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  lines: {
    key: string;
    name: string;
    color?: string;
  }[];
  height?: number;
}

export function LineChartComponent({
  data,
  xKey,
  lines,
  height = 200,
}: LineChartProps) {
  const id = useId();
  const width = 480;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const labels = data.map((d) => String(d[xKey] ?? ""));
  const count = Math.max(labels.length, 1);

  const xAt = (i: number) => pad.left + (i / Math.max(count - 1, 1)) * plotW;
  const maxVal = Math.max(
    10,
    ...data.flatMap((d) => lines.map((l) => Number(d[l.key] ?? 0)))
  );
  const yAt = (v: number) => pad.top + plotH - (Math.max(0, v) / maxVal) * plotH;

  return (
    <div style={{ width: "100%", height }}>
      <svg
        role="img"
        aria-label="Line chart"
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full max-w-full"
      >
        {labels.map((label, i) => (
          <text
            key={`${id}-x-${i}`}
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {label}
          </text>
        ))}
        {lines.map((l, sIdx) => {
          const color = l.color ?? (sIdx === 0 ? "hsl(var(--primary))" : "#10b981");
          const points = data.map((d, i) => ({ x: xAt(i), y: yAt(Number(d[l.key] ?? 0)) }));
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
    </div>
  );
}
