/**
 * Context Panel — the right-side rail that shows the
 * four context tiles the spec requires:
 *
 *   1. Current Business Score
 *   2. Business DNA
 *   3. Recommendation Count
 *   4. Roadmap Progress
 *
 * Reuses the existing DashboardCard, AnimatedCounter,
 * ProgressBar, and LevelBadge primitives. The "incomplete"
 * flag is surfaced as a soft warning at the top so the
 * user knows the engine is mid-run.
 */

"use client";

import Link from "next/link";
import { ArrowRight, AlertCircle, Compass, ListChecks, Map, Sparkles } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { cn } from "@/lib/utils";
import type { AssistantContext } from "./types";

interface ContextPanelProps {
  context: AssistantContext;
}

export function ContextPanel({ context }: ContextPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardCard
        badge="Context"
        title="Business Context"
        caption="The four signals the assistant uses to ground every answer."
      >
        {context.incomplete && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>
              The current analysis is incomplete — recommendations, roadmap,
              or rule firings may be missing or zero. Answers will reflect
              the available data.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <ScoreTile context={context} />
          <DnaTile context={context} />
          <RecommendationTile context={context} />
          <RoadmapTile context={context} />
        </div>
      </DashboardCard>
      <QuickLinksCard />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Tiles
// --------------------------------------------------------------------------- //

function ScoreTile({ context }: { context: AssistantContext }) {
  const { value, band } = context.score;
  const tone = levelToTone(band);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex size-9 items-center justify-center rounded-md",
            tone,
          )}
        >
          <Sparkles className="size-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Current Business Score
          </p>
          <p className="text-base font-semibold text-foreground">
            <AnimatedCounter value={value} className="text-base font-semibold" />
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </p>
        </div>
      </div>
      <LevelBadge level={band} tone={tone} />
    </div>
  );
}

function DnaTile({ context }: { context: AssistantContext }) {
  const { archetype, match } = context.dna;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Compass className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Business DNA
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {archetype}
          </p>
          <p className="text-xs text-muted-foreground">
            {match}% match
          </p>
        </div>
      </div>
    </div>
  );
}

function RecommendationTile({ context }: { context: AssistantContext }) {
  const { total, critical, high } = context.recommendations;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <ListChecks className="size-4" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Recommendations
          </p>
          <p className="text-base font-semibold text-foreground">
            {total}
          </p>
          <p className="text-xs text-muted-foreground">
            {critical} critical · {high} high
          </p>
        </div>
      </div>
    </div>
  );
}

function RoadmapTile({ context }: { context: AssistantContext }) {
  const { totalItems, avgCompletion, currentPhase, totalDuration } =
    context.roadmap;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"
          >
            <Map className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Roadmap Progress
            </p>
            <p className="text-sm font-semibold text-foreground">
              {totalItems} items · {currentPhase}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalDuration} total
            </p>
          </div>
        </div>
        <span className="text-base font-semibold text-foreground">
          {avgCompletion}%
        </span>
      </div>
      <ProgressBar value={avgCompletion} />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Quick links — lets the user jump to the underlying screens
// --------------------------------------------------------------------------- //

function QuickLinksCard() {
  return (
    <DashboardCard badge="Explore" title="Explore the data" compact>
      <ul className="flex flex-col gap-1">
        {QUICK_LINKS.map((q) => (
          <li key={q.href}>
            <Link
              href={q.href}
              className="inline-flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span>{q.label}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

const QUICK_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" },
  { href: "/action-board", label: "Action Board" },
  { href: "/insights", label: "Insights" },
  { href: "/reports", label: "Reports" },
] as const;

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //
