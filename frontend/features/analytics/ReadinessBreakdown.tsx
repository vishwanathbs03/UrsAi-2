"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import {
  levelToTone,
  scoreFill,
  scoreSurfaceTone,
  scoreEdgeTone,
} from "@/features/dashboard/tones";
import type { ScoreLevel } from "@/types/dashboard";
import {
  READINESS_KEYS,
  scoreByKey,
  type AnalyticsData,
} from "./use-analytics-data";

interface ReadinessBreakdownProps {
  data: AnalyticsData;
}

/**
 * Six-pillar readiness breakdown — digital, export, compliance,
 * growth, innovation, sustainability.
 */
export function ReadinessBreakdown({ data }: ReadinessBreakdownProps) {
  const pillars = READINESS_KEYS.map((key) => {
    const score = scoreByKey(data.twin, key);
    return score ? { key, ...score } : null;
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <DashboardCard
      badge="Readiness"
      title="Readiness Breakdown"
      caption="Six operational pillars from the Business Score Engine."
    >
      {pillars.length === 0 ? (
        <p className="text-sm text-muted-foreground">No readiness scores available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => {
            const level = (p.level ?? "Low") as ScoreLevel;
            return (
              <div
                key={p.key}
                className={`flex flex-col gap-2 rounded-lg border border-border border-l-4 ${scoreEdgeTone(level)} ${scoreSurfaceTone(level)} p-3`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{p.title}</p>
                  <LevelBadge level={level} tone={levelToTone(level)} />
                </div>
                <ProgressBar
                  value={p.score ?? 0}
                  label="Score"
                  hint={
                    <span className="inline-flex items-baseline gap-1">
                      <AnimatedCounter value={p.score ?? 0} />
                      <span className="text-muted-foreground">/ 100</span>
                    </span>
                  }
                  fillClassName={scoreFill(level)}
                />
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
