"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { TwinResponse } from "@/types/analytics";

interface ProjectionCardsProps {
  twin: TwinResponse;
}

/**
 * Projection Cards — four deterministic summary cards that
 * quantify the impact of executing the full roadmap over the
 * next 12 months:
 *
 *   - Expected Improvements  =
 *       twelve_month.projected_overall_score
 *       - current.projected_overall_score
 *     Source: twin.timeline.{current,twelve_month}
 *
 *   - Risk Reduction =
 *       count of active risk_matrix entries (critical_risks +
 *       high_risks + medium_risks) at the 12-month horizon.
 *     Assumes each active risk is addressed by exactly one
 *     roadmap item (the engine schedules one roadmap item
 *     per supporting rule id, and every active risk has at
 *     least one supporting rule). When
 *     timeline.twelve_month.roadmap_completion_pct < 100, we
 *     scale the count by completion_pct/100 to keep the
 *     number honest.
 *     Source: twin.risk_matrix + twin.timeline.twelve_month
 *
 *   - Recommendation Completion =
 *       timeline.twelve_month.roadmap_completion_pct
 *     Source: twin.timeline.twelve_month
 *
 *   - Roadmap Progress =
 *       timeline.twelve_month.roadmap_completion_pct
 *     Same number as Recommendation Completion, but
 *     interpreted as "% of roadmap items completed" — see
 *     the inline note.
 */
export function ProjectionCards({ twin }: ProjectionCardsProps) {
  const tl = twin.timeline;
  const expectedImprovement =
    tl.twelve_month.projected_overall_score -
    tl.current.projected_overall_score;

  const activeRiskCount =
    twin.risk_matrix.critical_risks.length +
    twin.risk_matrix.high_risks.length +
    twin.risk_matrix.medium_risks.length;
  const completionPct = tl.twelve_month.roadmap_completion_pct;
  const riskReduction = Math.max(
    0,
    Math.round((activeRiskCount * completionPct) / 100),
  );

  const cards = [
    {
      icon: <TrendingUp className="size-4" aria-hidden="true" />,
      badge: "Improvement",
      title: "Expected Improvements",
      value: expectedImprovement,
      suffix: "pts",
      caption:
        expectedImprovement >= 0
          ? `+${expectedImprovement} pts in 12 months (deterministic)`
          : `${expectedImprovement} pts in 12 months (projection is below current)`,
      tone: levelToTone(
        expectedImprovement >= 20
          ? "high"
          : expectedImprovement >= 5
            ? "medium"
            : "low",
      ),
      iconTone: "bg-emerald-100 text-emerald-700",
    },
    {
      icon: <AlertTriangle className="size-4" aria-hidden="true" />,
      badge: "Risks",
      title: "Risk Reduction",
      value: riskReduction,
      suffix: activeRiskCount === 1 ? "risk" : "risks",
      caption:
        activeRiskCount === 0
          ? "No active risks detected"
          : `${riskReduction} of ${activeRiskCount} active risk(s) addressed by 12m`,
      tone: levelToTone(
        riskReduction === 0
          ? "low"
          : completionPct >= 80
            ? "high"
            : "medium",
      ),
      iconTone: "bg-rose-100 text-rose-700",
    },
    {
      icon: <ListChecks className="size-4" aria-hidden="true" />,
      badge: "Recommendations",
      title: "Recommendation Completion",
      value: completionPct,
      suffix: "%",
      caption: `${tl.twelve_month.items_completed} item(s) completed by 12m`,
      tone: levelToTone(
        completionPct >= 70 ? "high" : completionPct >= 40 ? "medium" : "low",
      ),
      iconTone: "bg-primary/10 text-primary",
    },
    {
      icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
      badge: "Roadmap",
      title: "Roadmap Progress",
      value: completionPct,
      suffix: "%",
      caption: `${tl.twelve_month.items_remaining} item(s) remaining at 12m`,
      tone: levelToTone(
        completionPct >= 70 ? "high" : completionPct >= 40 ? "medium" : "low",
      ),
      iconTone: "bg-emerald-100 text-emerald-700",
      progress: true,
    },
  ];

  return (
    <div
      role="region"
      aria-label="Projection cards"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <DashboardCard
          key={card.title}
          badge={card.badge}
          title={card.title}
          compact
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex size-9 items-center justify-center rounded-full ${card.iconTone}`}
              aria-hidden="true"
            >
              {card.icon}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                <AnimatedCounter value={card.value} suffix={card.suffix} />
              </span>
              {card.caption && (
                <span className="mt-0.5 line-clamp-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {card.tone ? (
                    <LevelBadge level={card.caption} tone={card.tone} />
                  ) : (
                    card.caption
                  )}
                </span>
              )}
            </div>
          </div>
          {card.progress && (
            <ProgressBar
              value={card.value}
              fillClassName="bg-emerald-500"
              label={card.title}
            />
          )}
        </DashboardCard>
      ))}
    </div>
  );
}
