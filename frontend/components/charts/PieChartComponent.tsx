"use client";

import React, { useId } from "react";

export interface PieChartProps {
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function PieChartComponent({
  data,
  colors = DEFAULT_COLORS,
  height = 200,
}: PieChartProps) {
  const id = useId();
  const total = Math.max(1, data.reduce((acc, d) => acc + d.value, 0));
  let cumulativeAngle = 0;

  return (
    <div style={{ width: "100%", height }} className="flex items-center justify-center gap-4">
      <svg viewBox="0 0 100 100" className="h-full max-h-[180px] w-auto">
        {data.map((item, idx) => {
          const sliceAngle = (item.value / total) * 360;
          const startAngle = cumulativeAngle;
          cumulativeAngle += sliceAngle;

          const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180);
          const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180);
          const x2 = 50 + 40 * Math.cos((Math.PI * cumulativeAngle) / 180);
          const y2 = 50 + 40 * Math.sin((Math.PI * cumulativeAngle) / 180);

          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
          const color = colors[idx % colors.length];

          return <path key={`${id}-slice-${idx}`} d={pathData} fill={color} />;
        })}
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        {data.map((item, idx) => (
          <div key={`${id}-leg-${idx}`} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: colors[idx % colors.length] }}
            />
            <span className="text-muted-foreground">{item.name}:</span>
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
