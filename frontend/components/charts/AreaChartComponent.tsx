"use client";

import React, { useId } from "react";

export interface AreaChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  areas: {
    key: string;
    name: string;
    color?: string;
  }[];
  height?: number;
}

export function AreaChartComponent({
  data,
  xKey,
  areas,
  height = 200,
}: AreaChartProps) {
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
    ...data.flatMap((d) => areas.map((a) => Number(d[a.key] ?? 0)))
  );
  const yAt = (v: number) => pad.top + plotH - (Math.max(0, v) / maxVal) * plotH;

  return (
    <div style={{ width: "100%", height }}>
      <svg
        role="img"
        aria-label="Area chart"
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
        {areas.map((a, sIdx) => {
          const color = a.color ?? (sIdx === 0 ? "hsl(var(--primary))" : "#10b981");
          const points = data.map((d, i) => ({ x: xAt(i), y: yAt(Number(d[a.key] ?? 0)) }));
          const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const areaPath = `${linePath} L ${xAt(count - 1)} ${pad.top + plotH} L ${xAt(0)} ${pad.top + plotH} Z`;

          return (
            <g key={`${id}-area-${sIdx}`}>
              <path d={areaPath} fill={color} fillOpacity={0.2} />
              <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
