"use client";

import { useId } from "react";
import { Activity, CalendarClock, Sparkles, Target } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { TwinResponse } from "@/types/analytics";

interface PredictionOverviewProps {
  twin: TwinResponse;
}

/**
 * Prediction Overview — four KPI tiles reporting the
 * deterministic projection points from `twin.timeline`:
 *
 *   Current Score         -> timeline.current.projected_overall_score
 *   Projected 3 Months    -> timeline.three_month.projected_overall_score
 *   Projected 6 Months    -> timeline.six_month.projected_overall_score
 *   Projected 12 Months   -> timeline.twelve_month.projected_overall_score
 *
 * Every value is read straight from the upstream payload —
 * no derivation, no rounding other than the 0..100 cap
 * the engine already applies.
 */
export function PredictionOverview({ twin }: PredictionOverviewProps) {
  const tl = twin.timeline;
  const current = tl.current.projected_overall_score;
  const p3 = tl.three_month.projected_overall_score;
  const p6 = tl.six_month.projected_overall_score;
  const p12 = tl.twelve_month.projected_overall_score;

  const tiles = [
    {
      icon: <Activity className="size-4" aria-hidden="true" />,
      badge: "Current",
      title: "Current Score",
      value: current,
      caption: twin.scores.overall_level,
      tone: levelToTone(
        current >= 70 ? "high" : current >= 40 ? "medium" : "low",
      ),
    },
    {
      icon: <CalendarClock className="size-4" aria-hidden="true" />,
      badge: "3 Months",
      title: "Projected 3 Months",
      value: p3,
      caption: tl.three_month.notes,
      tone: levelToTone(p3 >= 70 ? "high" : p3 >= 40 ? "medium" : "low"),
    },
    {
      icon: <CalendarClock className="size-4" aria-hidden="true" />,
      badge: "6 Months",
      title: "Projected 6 Months",
      value: p6,
      caption: tl.six_month.notes,
      tone: levelToTone(p6 >= 70 ? "high" : p6 >= 40 ? "medium" : "low"),
    },
    {
      icon: <Target className="size-4" aria-hidden="true" />,
      badge: "12 Months",
      title: "Projected 12 Months",
      value: p12,
      caption: tl.twelve_month.notes,
      tone: levelToTone(p12 >= 70 ? "high" : p12 >= 40 ? "medium" : "low"),
    },
  ];

  return (
    <div
      role="region"
      aria-label="Prediction overview"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {tiles.map((tile) => (
        <KpiTile
          key={tile.title}
          icon={tile.icon}
          badge={tile.badge}
          title={tile.title}
          value={tile.value}
          caption={tile.caption}
          tone={tile.tone}
        />
      ))}
    </div>
  );
}

interface KpiTileProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  value: number;
  caption: string;
  tone: string;
}

function KpiTile({ icon, badge, title, value, caption, tone }: KpiTileProps) {
  const id = useId();
  return (
    <DashboardCard badge={badge} title={title} compact>
      <div className="flex items-center gap-3">
        <span
          className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <span
            id={id}
            className="text-2xl font-semibold text-foreground tabular-nums"
          >
            <AnimatedCounter value={value} suffix="/100" />
          </span>
          {caption && (
            <span className="mt-0.5 line-clamp-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {tone ? <LevelBadge level={caption} tone={tone} /> : caption}
            </span>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
