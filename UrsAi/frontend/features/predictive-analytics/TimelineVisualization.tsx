"use client";

import { useState } from "react";
import { useId } from "react";
import { CalendarClock } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import type { TwinResponse } from "@/types/analytics";
import {
  TIMELINE_TAB_OPTIONS,
  type TimelineKey,
} from "./use-predictive-filters";

interface TimelineVisualizationProps {
  twin: TwinResponse;
}

/**
 * Timeline Visualization — four tabs (Current / 3 Months /
 * 6 Months / 12 Months) that reveal the full detail of the
 * matching `twin.timeline.*` projection:
 *
 *   - projected_overall_score
 *   - projected_digital_score
 *   - projected_compliance_score
 *   - projected_export_score
 *   - projected_growth_score
 *   - items_completed / items_remaining
 *   - roadmap_completion_pct
 *   - the human-readable notes string the engine produced
 *
 * All values come from the upstream payload. No derivation.
 */
export function TimelineVisualization({ twin }: TimelineVisualizationProps) {
  const [active, setActive] = useState<TimelineKey>("current");
  const tabIdPrefix = useId();

  const projection = twin.timeline[active];
  const overall = projection.projected_overall_score;
  const digital = projection.projected_digital_score;
  const compliance = projection.projected_compliance_score;
  const exportScore = projection.projected_export_score;
  const growth = projection.projected_growth_score;
  const completionPct = projection.roadmap_completion_pct;

  const pillarTiles = [
    {
      label: "Overall",
      value: overall,
      tone: levelToTone(
        overall >= 70 ? "high" : overall >= 40 ? "medium" : "low",
      ),
    },
    {
      label: "Digital",
      value: digital,
      tone: levelToTone(
        digital >= 70 ? "high" : digital >= 40 ? "medium" : "low",
      ),
    },
    {
      label: "Compliance",
      value: compliance,
      tone: levelToTone(
        compliance >= 70 ? "high" : compliance >= 40 ? "medium" : "low",
      ),
    },
    {
      label: "Export",
      value: exportScore,
      tone: levelToTone(
        exportScore >= 70 ? "high" : exportScore >= 40 ? "medium" : "low",
      ),
    },
    {
      label: "Growth",
      value: growth,
      tone: levelToTone(
        growth >= 70 ? "high" : growth >= 40 ? "medium" : "low",
      ),
    },
  ];

  return (
    <DashboardCard
      badge="Timeline"
      title="Timeline Visualization"
      caption="Step through the four deterministic projection points the engine produces."
    >
      <div
        role="tablist"
        aria-label="Timeline projection points"
        className="flex flex-wrap gap-2"
      >
        {TIMELINE_TAB_OPTIONS.map((opt) => {
          const isActive = opt.value === active;
          const tabId = `${tabIdPrefix}-tab-${opt.value}`;
          const panelId = `${tabIdPrefix}-panel-${opt.value}`;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              onClick={() => setActive(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${tabIdPrefix}-panel-${active}`}
        aria-labelledby={`${tabIdPrefix}-tab-${active}`}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pillarTiles.map((tile) => (
            <div
              key={tile.label}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-secondary/30 px-3 py-4 text-center"
            >
              <AnimatedCounter
                value={tile.value}
                suffix="/100"
                className="text-xl font-semibold text-foreground"
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {tile.label}
              </span>
              <LevelBadge level={`${tile.value}/100`} tone={tile.tone} />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Roadmap
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-semibold text-foreground tabular-nums">
              <AnimatedCounter value={completionPct} suffix="%" />
            </span>
          </div>
          <ProgressBar
            value={completionPct}
            label="Roadmap completion"
            fillClassName="bg-primary"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              Items completed:{" "}
              <span className="font-mono text-foreground">
                {projection.items_completed}
              </span>
            </span>
            <span>
              Items remaining:{" "}
              <span className="font-mono text-foreground">
                {projection.items_remaining}
              </span>
            </span>
          </div>
        </div>

        <p className="rounded-md border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
          {projection.notes}
        </p>
      </div>
    </DashboardCard>
  );
}
