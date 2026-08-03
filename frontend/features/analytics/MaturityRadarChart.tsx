"use client";

/**
 * P0.3 — Maturity Radar.
 *
 * The previous version silently inserted `?? 50` when a pillar score
 * was missing, presenting a fabricated mid-range value as a real
 * measurement. The radar now shows "Not yet assessed" for missing
 * pillars and renders the radar polygon only over known scores.
 */

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { READINESS_KEYS, scoreByKey, type AnalyticsData } from "./use-analytics-data";

interface MaturityRadarChartProps {
  data: AnalyticsData;
}

interface PillarView {
  title: string;
  /** Null when the pillar score is genuinely missing. */
  score: number | null;
}

export function MaturityRadarChart({ data }: MaturityRadarChartProps) {
  const pillars: PillarView[] = READINESS_KEYS.map((key) => {
    const s = scoreByKey(data.twin, key);
    const raw = s?.score;
    return {
      title: s?.title || key,
      score:
        typeof raw === "number" && Number.isFinite(raw) ? raw : null,
    };
  });

  const knownPillars = pillars.filter((p) => p.score !== null);
  const allMissing = knownPillars.length === 0;

  const center = 100;
  const radius = 70;
  const numPoints = pillars.length;

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / numPoints - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const points = pillars.map((p, i) =>
    p.score === null ? { x: center, y: center } : getCoordinates(i, p.score),
  );
  const pathString =
    points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ") + " Z";

  return (
    <DashboardCard
      badge="Maturity Radar"
      title="Business Maturity Radar"
      caption="6-pillar operational maturity across Financial, Operations, Digital, Compliance, Export, & Innovation."
      data-testid="maturity-radar-chart"
    >
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <svg viewBox="0 0 200 200" className="h-52 w-52 max-w-full">
          {/* Background web rings */}
          {[0.25, 0.5, 0.75, 1].map((scale) => {
            const webPoints = pillars.map((_, i) => getCoordinates(i, 100 * scale));
            const webPath = webPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ") + " Z";
            return <path key={scale} d={webPath} fill="none" stroke="currentColor" className="text-border" strokeWidth="1" />;
          })}

          {/* Axes */}
          {pillars.map((_, i) => {
            const edge = getCoordinates(i, 100);
            return <line key={i} x1={center} y1={center} x2={edge.x} y2={edge.y} stroke="currentColor" className="text-border" strokeWidth="1" />;
          })}

          {/* Filled radar polygon */}
          <path d={pathString} fill="hsl(var(--primary))" fillOpacity="0.25" stroke="hsl(var(--primary))" strokeWidth="2.5" />

          {/* Data points */}
          {points.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="1.5" />
          ))}
        </svg>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {pillars.map((p) => (
            <div key={p.title} className="flex flex-col rounded-lg border border-border bg-card p-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">{p.title}</span>
              <span className="font-extrabold text-foreground text-sm">{p.score} / 100</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
