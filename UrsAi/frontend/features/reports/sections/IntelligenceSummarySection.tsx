"use client";

import { ReportSection } from "../ReportSection";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { levelToTone } from "@/features/dashboard/tones";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "intelligence-summary",
  id: "report-intelligence-summary",
  badge: "Intelligence",
  title: "Intelligence Summary",
  caption: "Profile intelligence and per-analyzer coverage.",
};

interface IntelligenceSummarySectionProps {
  data: ReportsData;
}

/**
 * Intelligence Summary — the overall intelligence score and a
 * table of per-analyzer scores. Surfaces the breakdown keys
 * only for analyzers that produced them.
 */
export function IntelligenceSummarySection({ data }: IntelligenceSummarySectionProps) {
  const { overall, analyzers } = data.intelligence;
  return (
    <ReportSection meta={META}>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overall intelligence
          </span>
          <span className="text-3xl font-semibold text-foreground">
            <AnimatedCounter value={overall.score} />
            <span className="text-base text-muted-foreground"> / 100</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {overall.analyzer_count} analyzers evaluated.
          </span>
        </div>
        <LevelBadge
          level={overall.level}
          tone={levelToTone(overall.level)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {analyzers.map((a) => (
          <div
            key={a.key}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {a.title}
              </span>
              <LevelBadge
                level={a.level}
                tone={levelToTone(a.level)}
              />
            </div>
            <ProgressBar
              value={a.score}
              label="Score"
              hint={
                <span className="inline-flex items-baseline gap-1">
                  <AnimatedCounter value={a.score} />
                  <span className="text-muted-foreground">/ 100</span>
                </span>
              }
            />
            {a.summary && (
              <p className="text-xs leading-snug text-muted-foreground">
                {a.summary}
              </p>
            )}
            {a.missing.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Missing: {a.missing.length} signal
                {a.missing.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
