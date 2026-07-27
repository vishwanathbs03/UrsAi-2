"use client";

import Link from "next/link";
import {
  AlertOctagon,
  ArrowRight,
  Lightbulb,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import { useAdvisorData } from "@/features/advisor";

/**
 * Advisor widget — the compact dashboard card that
 * surfaces the advisor's "today's brief" snapshot. Shows:
 *   - the daily-brief item count
 *   - the top-priority title + priority badge
 *   - the critical-risk count (from health_review.risk_count)
 *   - the suggested-actions count
 *
 * Clicking the card navigates to /advisor for the full
 * advice page. The widget is read-only — no action
 * triggers, no automation.
 */
export function AdvisorWidget() {
  const { state } = useAdvisorData();

  if (state.status !== "ready") {
    return <AdvisorWidgetSkeleton />;
  }

  const { advisor } = state.data;
  const dailyCount = advisor.daily_brief.length;
  const actionsCount = advisor.suggested_actions.length;
  const riskCount = Number(advisor.health_review.risk_count) || 0;
  const topBrief = advisor.daily_brief[0] ?? null;
  const topAction = advisor.suggested_actions[0] ?? null;
  const topPriority = topBrief?.priority || topAction?.priority || "Low";

  return (
    <DashboardCard
      badge="Advisor"
      title="Today's Brief"
      caption="The advisor's top-of-mind items — click through for the full read."
      compact
    >
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          icon={<Lightbulb className="size-3.5" aria-hidden="true" />}
          label="Daily brief"
          value={dailyCount}
        />
        <StatTile
          icon={<AlertOctagon className="size-3.5" aria-hidden="true" />}
          label="Critical risks"
          value={riskCount}
          tone={
            riskCount > 0
              ? "text-rose-600"
              : "text-emerald-600"
          }
        />
        <StatTile
          icon={<ListChecks className="size-3.5" aria-hidden="true" />}
          label="Suggested actions"
          value={actionsCount}
        />
        <StatTile
          icon={<Sparkles className="size-3.5 text-primary" aria-hidden="true" />}
          label="Top priority"
          value={null}
          badge={
            <LevelBadge
              level={topPriority}
              tone={levelToTone(topPriority)}
            />
          }
        />
      </div>
      <Link
        href="/advisor"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        aria-label="Open the full advisor page"
      >
        Open advisor
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </DashboardCard>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  badge?: React.ReactNode;
  tone?: string;
}

function StatTile({ icon, label, value, badge, tone }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      {value !== null ? (
        <AnimatedCounter
          value={value}
          className={cn(
            "text-lg font-semibold tabular-nums",
            tone ?? "text-foreground",
          )}
          durationMs={500}
        />
      ) : (
        badge ?? <span className="text-sm text-muted-foreground">—</span>
      )}
    </div>
  );
}

function AdvisorWidgetSkeleton() {
  return (
    <DashboardCard
      badge="Advisor"
      title="Today's Brief"
      caption="The advisor's top-of-mind items — click through for the full read."
      compact
    >
      <DashboardSkeleton rows={3} />
    </DashboardCard>
  );
}
