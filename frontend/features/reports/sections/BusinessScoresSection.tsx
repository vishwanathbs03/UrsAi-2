"use client";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { ReportSection } from "../ReportSection";
import { levelToTone } from "@/features/dashboard/tones";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "business-scores",
  id: "report-business-scores",
  badge: "Scores",
  title: "Business Scores",
  caption: "Per-pillar scores, levels, and band distribution.",
};

interface BusinessScoresSectionProps {
  data: ReportsData;
}

/**
 * Business Scores — per-pillar score + level from the Business
 * Score Engine, plus the band distribution across every pillar.
 * No re-computation; the band distribution is reported by the
 * scores engine itself.
 */
export function BusinessScoresSection({ data }: BusinessScoresSectionProps) {
  const { scores, summary } = data.scores;
  const distribution = summary.band_distribution;

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scores.map((s) => {
            const level = s.level || s.band || "Low";
            return (
              <div
                key={s.key}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {s.title}
                  </span>
                  <LevelBadge level={level} tone={levelToTone(level)} />
                </div>
                <span className="text-2xl font-semibold text-foreground">
                  <AnimatedCounter value={s.score} />
                  <span className="text-xs text-muted-foreground"> / 100</span>
                </span>
                {s.description && (
                  <p className="text-xs text-muted-foreground leading-snug">
                    {s.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <aside
          aria-label="Band distribution"
          className="flex w-full flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 md:w-56"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Band distribution
          </p>
          {Object.entries(distribution).map(([band, count]) => (
            <div
              key={band}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <LevelBadge level={band} tone={levelToTone(band)} />
              <span className="font-semibold tabular-nums text-foreground">
                <AnimatedCounter value={count} />
              </span>
            </div>
          ))}
          <p className="mt-1 text-[10px] text-muted-foreground">
            Across {summary.weighted_inputs} weighted inputs.
          </p>
        </aside>
      </div>
    </ReportSection>
  );
}
