"use client";

import { useMemo } from "react";
import { CheckCircle2, CircleDot, Clock, ListTodo, Sparkles, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import {
  type ActionCardItem,
  PRIORITY_LABELS,
} from "./use-action-board-data";
import type { ActionStatus } from "./use-action-status-storage";

interface BoardSummaryPanelProps {
  cards: ActionCardItem[];
  /** Map of action id → persisted status, used to count
   *  completed / in-progress / todo. */
  statuses: Record<string, ActionStatus>;
  /** Current business score, used to compute the
   *  "projected score" with completed/in-progress actions
   *  applied. If null, the projection is hidden. */
  currentScore: number | null;
}

/**
 * Aggregate of the action board's three derived numbers:
 *  1. Progress — completed vs total
 *  2. Overall business improvement — projected score lift
 *     from the actions the user has already moved into
 *     In Progress / Completed
 *  3. Impact summary — by-priority and by-status breakdown
 *
 * Sprint 4 dashboard polish: this panel is the "header
 * strip" below the column titles so the user can see at a
 * glance how much of the board they've worked through and
 * what the projected business improvement looks like.
 */
export function BoardSummaryPanel({
  cards,
  statuses,
  currentScore,
}: BoardSummaryPanelProps) {
  const counts = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let completed = 0;
    for (const c of cards) {
      const s = statuses[c.id] ?? "todo";
      if (s === "completed") completed++;
      else if (s === "in_progress") inProgress++;
      else todo++;
    }
    return { todo, inProgress, completed, total: cards.length };
  }, [cards, statuses]);

  // Aggregate impact: total potential (sum of every card),
  // realised (sum of completed + 0.5*in_progress), and
  // remaining (sum of todo).
  const impact = useMemo(() => {
    let total = 0;
    let realised = 0;
    let remaining = 0;
    for (const c of cards) {
      total += c.estimatedBusinessImpact;
      const s = statuses[c.id] ?? "todo";
      if (s === "completed") {
        realised += c.estimatedBusinessImpact;
      } else if (s === "in_progress") {
        // Half-credit the in-progress impact so the panel
        // shows the user is part-way there.
        realised += c.estimatedBusinessImpact * 0.5;
        remaining += c.estimatedBusinessImpact * 0.5;
      } else {
        remaining += c.estimatedBusinessImpact;
      }
    }
    return {
      total: Math.round(total),
      realised: Math.round(realised),
      remaining: Math.round(remaining),
    };
  }, [cards, statuses]);

  // Projected overall business score. The lift is the sum
  // of expectedScoreImprovement on completed + 0.5 *
  // expectedScoreImprovement on in-progress. Capped so a
  // saturated board cannot project more than 100.
  const projectedLift = useMemo(() => {
    let lift = 0;
    for (const c of cards) {
      const s = statuses[c.id] ?? "todo";
      if (s === "completed") lift += c.expectedScoreImprovement;
      else if (s === "in_progress") lift += c.expectedScoreImprovement * 0.5;
    }
    return lift;
  }, [cards, statuses]);

  const projectedScore =
    currentScore === null
      ? null
      : Math.min(100, Math.round(currentScore + projectedLift));

  const progressPct = counts.total === 0 ? 0 : (counts.completed / counts.total) * 100;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Progress (completed vs total) */}
      <DashboardCard
        badge="Progress"
        title="Actions completed"
        caption={`${counts.completed} of ${counts.total} action${counts.total === 1 ? "" : "s"} marked done`}
        compact
      >
        <ProgressBar
          value={progressPct}
          label="Completion"
          hint={
            <span className="inline-flex items-baseline gap-1">
              <AnimatedCounter value={counts.completed} />
              <span className="text-muted-foreground">/ {counts.total}</span>
            </span>
          }
        />
        <ul className="flex flex-col gap-1.5 text-xs">
          <StatusRow
            icon={<ListTodo className="size-3.5" aria-hidden="true" />}
            label="To Do"
            count={counts.todo}
            tone="text-slate-600"
          />
          <StatusRow
            icon={<Clock className="size-3.5" aria-hidden="true" />}
            label="In Progress"
            count={counts.inProgress}
            tone="text-amber-600"
          />
          <StatusRow
            icon={<CheckCircle2 className="size-3.5" aria-hidden="true" />}
            label="Completed"
            count={counts.completed}
            tone="text-emerald-600"
          />
        </ul>
      </DashboardCard>

      {/* Overall business improvement */}
      <DashboardCard
        badge="Improvement"
        title="Business lift"
        caption="How much the overall score moves when the in-progress and completed actions land."
        compact
      >
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Current
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {currentScore === null ? "—" : <AnimatedCounter value={currentScore} />}
            </span>
          </div>
          <span className="mb-1 text-lg text-muted-foreground" aria-hidden="true">
            →
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Projected
            </span>
            <span className="text-2xl font-semibold tabular-nums text-emerald-600">
              {projectedScore === null ? "—" : <AnimatedCounter value={projectedScore} />}
            </span>
          </div>
          {currentScore !== null && projectedScore !== null && (
            <span className="mb-1 ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              <TrendingUp className="size-3" aria-hidden="true" />+
              <AnimatedCounter
                value={projectedScore - currentScore}
                durationMs={500}
              />
            </span>
          )}
        </div>
        {currentScore === null && (
          <p className="text-[10px] text-muted-foreground">
            Set up your business profile to see a projected score.
          </p>
        )}
      </DashboardCard>

      {/* Impact summary */}
      <DashboardCard
        badge="Impact"
        title="Impact distribution"
        caption="Total estimated impact from the rule engine, with what you've already captured."
        compact
      >
        <div className="flex items-end gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              <AnimatedCounter value={impact.total} />
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground" aria-hidden="true">
            pts
          </span>
        </div>
        <ProgressBar
          value={impact.total === 0 ? 0 : (impact.realised / impact.total) * 100}
          label="Realised"
          hint={
            <span className="inline-flex items-baseline gap-1">
              <AnimatedCounter value={impact.realised} />
              <span className="text-muted-foreground">/ {impact.total} pts</span>
            </span>
          }
          fillClassName="bg-emerald-500"
        />
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            <AnimatedCounter value={impact.remaining} durationMs={400} />
          </span>{" "}
          pts of impact still on the board.
        </p>
        <PriorityBreakdown cards={cards} statuses={statuses} />
      </DashboardCard>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <span className={cn("inline-flex items-center gap-1.5 font-medium", tone)}>
        {icon}
        {label}
      </span>
      <span className="tabular-nums font-semibold text-foreground">
        <AnimatedCounter value={count} durationMs={400} />
      </span>
    </li>
  );
}

function PriorityBreakdown({
  cards,
  statuses,
}: {
  cards: ActionCardItem[];
  statuses: Record<string, ActionStatus>;
}) {
  const totals: Record<ActionCardItem["priority"], { count: number; impact: number }> = {
    Critical: { count: 0, impact: 0 },
    High: { count: 0, impact: 0 },
    Medium: { count: 0, impact: 0 },
    Low: { count: 0, impact: 0 },
  };
  for (const c of cards) {
    totals[c.priority].count += 1;
    totals[c.priority].impact += c.estimatedBusinessImpact;
  }
  const present = (Object.keys(totals) as ActionCardItem["priority"][])
    .filter((p) => totals[p].count > 0);
  if (present.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {present.map((p) => (
        <li
          key={p}
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5"
        >
          <span className="inline-flex items-center gap-1.5">
            <CircleDot className="size-3 text-muted-foreground" aria-hidden="true" />
            <LevelBadge
              level={PRIORITY_LABELS[p]}
              tone={levelToTone(
                p === "Critical" || p === "High" ? "low" : p === "Medium" ? "medium" : "high",
              )}
            />
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            <AnimatedCounter value={totals[p].count} durationMs={350} /> ·{" "}
            <AnimatedCounter value={Math.round(totals[p].impact)} durationMs={350} /> pts
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Export for the journey preview; used by the parent. */
export { Sparkles };
