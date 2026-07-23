"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { CircularScore } from "@/components/dashboard/CircularScore";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "./LevelBadge";
import {
  levelToTone,
  scoreEdgeTone,
  scoreSurfaceTone,
  scoreTone,
} from "./tones";
import type { ScoresResponse } from "@/types/dashboard";

interface OverallHealthCardProps {
  intelligenceScore: number;
  intelligenceLevel: string;
  scores: ScoresResponse | null;
}

/**
 * Overall Business Health — the hero card. Big circular score
 * (the headline number) + the band distribution chips for the
 * eight scores so the user can see at a glance how many
 * pillars are in each band.
 *
 * Sprint 4: the headline number is now an `AnimatedCounter`
 * that tweens from 0 to the value on first paint, and the
 * distribution chips gain a left-edge accent that colour-
 * codes the band.
 */
export function OverallHealthCard({
  intelligenceScore,
  intelligenceLevel,
  scores,
}: OverallHealthCardProps) {
  const dist = scores?.summary?.band_distribution ?? {
    Low: 0,
    Medium: 0,
    High: 0,
    Excellent: 0,
  };
  const summary = scores?.summary?.score ?? null;
  const summaryLevel = scores?.summary?.level ?? null;
  const headline = summary ?? intelligenceScore;

  return (
    <DashboardCard
      badge="Overall"
      title="Business Health"
      caption="A composite of the five intelligence lenses and the eight business scores."
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <CircularScore
            value={headline}
            size={140}
            thickness={10}
            caption={summaryLevel ?? intelligenceLevel}
            ariaLabel="Overall business health"
          />
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Intelligence</span>
              <AnimatedCounter
                value={intelligenceScore}
                className="font-semibold text-foreground"
              />
              <LevelBadge level={intelligenceLevel} tone={levelToTone(intelligenceLevel)} />
            </div>
            {summary !== null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Summary</span>
                <AnimatedCounter
                  value={summary}
                  className="font-semibold text-foreground"
                />
                {summaryLevel && (
                  <LevelBadge level={summaryLevel} tone={levelToTone(summaryLevel)} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Score distribution
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["Excellent", "High", "Medium", "Low"] as const).map((band) => (
              <div
                key={band}
                className={`flex flex-col items-center justify-center rounded-lg border border-border ${scoreSurfaceTone(band)} ${scoreEdgeTone(band)} border-l-4 px-3 py-2`}
              >
                <AnimatedCounter
                  value={dist[band] ?? 0}
                  className={`text-lg font-semibold ${scoreTone(band)}`}
                  durationMs={500}
                />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {band}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
