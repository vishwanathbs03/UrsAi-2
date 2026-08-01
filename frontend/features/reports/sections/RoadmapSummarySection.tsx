"use client";

import { ReportSection } from "../ReportSection";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";
import type { RecommendationPhase } from "@/types/analytics";

const META: ReportSectionMeta = {
  key: "roadmap-summary",
  id: "report-roadmap-summary",
  badge: "Roadmap",
  title: "Roadmap Summary",
  caption: "Execution phases, completion, and projected lift.",
};

interface RoadmapSummarySectionProps {
  data: ReportsData;
}

const PHASES: RecommendationPhase[] = [
  "Immediate",
  "Short-Term",
  "Medium-Term",
  "Long-Term",
];

/**
 * Roadmap Summary — phase breakdown, completion, and
 * projected lift figures from the Roadmap engine.
 */
export function RoadmapSummarySection({ data }: RoadmapSummarySectionProps) {
  const { summary, items } = data.roadmap;
  const projections = summary.projections;

  const byPhase = PHASES.map((p) => items.filter((i) => i.phase === p));
  const avgCompletion =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce((acc, i) => acc + i.completion_percentage, 0) /
            items.length,
        );

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((phase, idx) => {
          const phaseItems = byPhase[idx];
          const phaseCompletion =
            phaseItems.length === 0
              ? 0
              : Math.round(
                  phaseItems.reduce(
                    (acc, i) => acc + i.completion_percentage,
                    0,
                  ) / phaseItems.length,
                );
          return (
            <div
              key={phase}
              className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{phase}</p>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  <AnimatedCounter value={phaseItems.length} />
                </span>
              </div>
              <ProgressBar
                value={phaseCompletion}
                ariaLabel={`${phase} completion`}
              />
              <p className="text-xs text-muted-foreground">
                {phaseCompletion}% avg completion
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProjectionStat
          label="Projected business score"
          value={projections.projected_business_score}
        />
        <ProjectionStat
          label="Projected profile completion"
          value={projections.projected_profile_completion}
          suffix="%"
        />
        <ProjectionStat
          label="Projected DNA shift"
          value={projections.projected_business_dna_shift}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProjectionStat
          label="Projected export readiness"
          value={projections.projected_export_readiness}
        />
        <ProjectionStat
          label="Projected digital readiness"
          value={projections.projected_digital_readiness}
        />
        <ProjectionStat
          label="Projected growth readiness"
          value={projections.projected_growth_readiness}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total items
          </span>
          <span className="text-xl font-semibold text-foreground tabular-nums">
            {summary.total_items}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total duration
          </span>
          <span className="text-xl font-semibold text-foreground">
            {summary.total_estimated_duration}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total est. ROI
          </span>
          <span className="text-xl font-semibold text-foreground tabular-nums">
            {summary.total_estimated_roi}%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Completion progress
        </p>
        <ProgressBar
          value={avgCompletion}
          label="Average completion"
          fillClassName="bg-primary"
        />
        <div className="flex flex-col gap-1.5">
          {items.slice(0, 8).map((it) => (
            <div
              key={it.recommendation_id}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {it.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {it.phase} · {it.estimated_duration}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {it.completion_percentage}%
                </span>
                <LevelBadge
                  level={it.priority}
                  tone={levelToTone(it.priority)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ReportSection>
  );
}

function ProjectionStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground tabular-nums">
        <AnimatedCounter value={value} suffix={suffix} />
      </span>
    </div>
  );
}
