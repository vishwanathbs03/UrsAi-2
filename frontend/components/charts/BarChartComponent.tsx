"use client";

import React, { useId } from "react";

export interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  bars: {
    key: string;
    name: string;
    color?: string;
  }[];
  height?: number;
}

export function BarChartComponent({
  data,
  xKey,
  bars,
  height = 200,
}: BarChartProps) {
  const id = useId();
  const width = 480;
  const pad = { top: 16, right: 16, bottom: 32, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const labels = data.map((d) => String(d[xKey] ?? ""));
  const count = Math.max(labels.length, 1);
  const groupW = plotW / count;
  const barW = Math.max(8, (groupW * 0.6) / Math.max(1, bars.length));

  const maxVal = Math.max(
    10,
    ...data.flatMap((d) => bars.map((b) => Number(d[b.key] ?? 0)))
  );

  return (
    <div style={{ width: "100%", height }}>
      <svg
        role="img"
        aria-label="Bar chart"
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full max-w-full"
      >
        {labels.map((label, i) => {
          const groupX = pad.left + i * groupW + groupW / 2;
          return (
            <text
              key={`${id}-x-${i}`}
              x={groupX}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          );
        })}
        {data.map((d, i) => {
          const groupX = pad.left + i * groupW + (groupW - bars.length * barW) / 2;
          return bars.map((b, bIdx) => {
            const val = Number(d[b.key] ?? 0);
            const barH = (Math.max(0, val) / maxVal) * plotH;
            const x = groupX + bIdx * barW;
            const y = pad.top + plotH - barH;
            const color = b.color ?? (bIdx === 0 ? "hsl(var(--primary))" : "#10b981");

            return (
              <rect
                key={`${id}-rect-${i}-${bIdx}`}
                x={x}
                y={y}
                width={barW - 2}
                height={barH}
                fill={color}
                rx={2}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}
