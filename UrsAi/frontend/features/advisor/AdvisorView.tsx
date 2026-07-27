"use client";

import { useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  Lightbulb,
  ListChecks,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone, scoreTone } from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import type {
  AdvisorAdvice,
  AdvisorResponse,
} from "@/types/advisor";
import { AdvisorActionCard } from "./AdvisorActionCard";
import { AdvisorSummaryCard } from "./AdvisorSummaryCard";
import { useAdvisorData } from "./use-advisor-data";

/**
 * Top-level Autonomous Business Advisor view.
 *
 * The page renders:
 *   1. Page header — Refresh + generated_at
 *   2. Business Summary — the deterministic one-paragraph
 *      snapshot (see AdvisorSummaryCard)
 *   3. Health Review — current + projected scores
 *   4. Seven advisor sections — Daily Brief, Weekly Summary,
 *      Priority Changes, Upcoming Risks, Missed Opportunities,
 *      Suggested Actions
 *
 * The advisor is read-only; the page never renders
 * action-trigger buttons. The state machine is the same
 * `loading / no-business / error / ready` shape used by
 * every other analytics surface.
 */
export function AdvisorView() {
  const { state, refresh, isFetching } = useAdvisorData();

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (state.status === "loading") {
    return <AdvisorSkeletonGrid />;
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          icon={<Building2 className="size-6" aria-hidden="true" />}
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to see the Autonomous Business Advisor."
          }
          actionLabel="Create business profile"
          onAction={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/business";
            }
          }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load the advisor"
          description={state.detail}
          actionLabel="Try again"
          onAction={handleRefresh}
        />
      </PageContainer>
    );
  }

  const { advisor } = state.data;
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <AdvisorPageHeader
          generatedAt={advisor.generated_at}
          isFetching={isFetching}
          onRefresh={handleRefresh}
        />
        <AdvisorSummaryCard
          summary={advisor.business_summary}
          generatedAt={advisor.generated_at}
        />
        <HealthReviewSection review={advisor.health_review} />
        <SectionGrid
          title="Daily Brief"
          icon={<Lightbulb className="size-4" aria-hidden="true" />}
          items={advisor.daily_brief}
          empty="Nothing new today — re-run the analysis if the underlying business state has changed."
          columns={2}
        />
        <SectionGrid
          title="Weekly Summary"
          icon={<Calendar className="size-4" aria-hidden="true" />}
          items={advisor.weekly_summary}
          empty="No weekly items yet — keep building the profile to surface more outlook signals."
          columns={2}
        />
        <SectionGrid
          title="Priority Changes"
          icon={<Target className="size-4" aria-hidden="true" />}
          items={advisor.priority_changes}
          empty="No priority changes recommended right now."
          columns={2}
        />
        <SectionGrid
          title="Upcoming Risks"
          icon={<ShieldAlert className="size-4" aria-hidden="true" />}
          items={advisor.upcoming_risks}
          empty="No upcoming risks surfaced — the existing risk matrix is clear."
          columns={2}
        />
        <SectionGrid
          title="Missed Opportunities"
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          items={advisor.missed_opportunities}
          empty="No missed opportunities right now."
          columns={2}
        />
        <SuggestedActionsSection actions={advisor.suggested_actions} />
      </div>
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Sub-views
// --------------------------------------------------------------------------- //

interface AdvisorPageHeaderProps {
  generatedAt: string | null;
  isFetching: boolean;
  onRefresh: () => void;
}

function AdvisorPageHeader({
  generatedAt,
  isFetching,
  onRefresh,
}: AdvisorPageHeaderProps) {
  return (
    <DashboardCard
      badge="Advisor"
      title="Autonomous Business Advisor"
      caption="Read-only, deterministic advice across the seven engine surfaces. The advisor never executes actions."
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={
            isFetching ? "Refreshing advisor" : "Refresh advisor"
          }
        >
          <RefreshCcw
            className={cn(
              "size-4 transition-transform",
              isFetching && "animate-spin",
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isFetching ? "Refreshing" : "Refresh"}
          </span>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Generated
        </span>
        <span className="font-mono text-foreground">
          {generatedAt ? formatTimestamp(generatedAt) : "—"}
        </span>
      </div>
    </DashboardCard>
  );
}

interface HealthReviewSectionProps {
  review: AdvisorResponse["health_review"];
}

function HealthReviewSection({ review }: HealthReviewSectionProps) {
  const current = Number(review.current_overall_score) || 0;
  const p3 = Number(review.projected_3m) || 0;
  const p6 = Number(review.projected_6m) || 0;
  const p12 = Number(review.projected_12m) || 0;
  const band = review.band || review.current_overall_level || "—";

  return (
    <DashboardCard
      badge="Health"
      title="Health Review"
      caption="Current score and the deterministic forward projections from the existing Digital Twin timeline."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProjectionTile
          label="Current"
          value={current}
          delta={0}
          tone={scoreTone(band)}
          icon={<Activity className="size-3.5" aria-hidden="true" />}
        />
        <ProjectionTile
          label="3 month"
          value={p3}
          delta={Number(review.delta_3m) || 0}
          tone={scoreTone(band)}
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
        />
        <ProjectionTile
          label="6 month"
          value={p6}
          delta={Number(review.delta_6m) || 0}
          tone={scoreTone(band)}
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
        />
        <ProjectionTile
          label="12 month"
          value={p12}
          delta={Number(review.delta_12m) || 0}
          tone={scoreTone(band)}
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <AlertOctagon className="size-3.5" aria-hidden="true" />
          Risk signals
        </span>
        <AnimatedCounter
          value={Number(review.risk_count) || 0}
          className="font-semibold text-foreground"
        />
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Opportunities
        </span>
        <AnimatedCounter
          value={Number(review.opportunity_count) || 0}
          className="font-semibold text-foreground"
        />
        <span className="inline-flex items-center gap-1.5">
          <Target className="size-3.5" aria-hidden="true" />
          Band
        </span>
        <LevelBadge level={band} tone={levelToTone(band)} />
      </div>
    </DashboardCard>
  );
}

interface ProjectionTileProps {
  label: string;
  value: number;
  delta: number;
  tone: string;
  icon: React.ReactNode;
}

function ProjectionTile({
  label,
  value,
  delta,
  tone,
  icon,
}: ProjectionTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <AnimatedCounter
          value={value}
          className={cn("text-xl font-semibold", tone)}
          durationMs={600}
        />
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      {delta !== 0 && (
        <span
          className={cn(
            "text-[10px] font-medium",
            delta > 0 ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {delta > 0 ? `+${delta}` : `${delta}`} vs current
        </span>
      )}
    </div>
  );
}

interface SectionGridProps {
  title: string;
  icon: React.ReactNode;
  items: AdvisorAdvice[];
  empty: string;
  columns?: 1 | 2;
}

function SectionGrid({
  title,
  icon,
  items,
  empty,
  columns = 2,
}: SectionGridProps) {
  const gridCls =
    columns === 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 gap-3 lg:grid-cols-2";
  return (
    <DashboardCard
      badge={title}
      title={title}
      caption={`${items.length} item${items.length === 1 ? "" : "s"} the advisor surfaces.`}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={icon}
          title={`No ${title.toLowerCase()} items`}
          description={empty}
        />
      ) : (
        <div className={gridCls}>
          {items.map((item) => (
            <SectionItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

interface SectionItemCardProps {
  item: AdvisorAdvice;
}

function SectionItemCard({ item }: SectionItemCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {item.title || "Untitled"}
        </span>
        <LevelBadge
          level={item.priority}
          tone={levelToTone(item.priority)}
        />
      </div>
      {item.summary && (
        <p className="text-xs text-muted-foreground">{item.summary}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3" aria-hidden="true" />
          {item.source}
        </span>
        <span className="font-mono">{item.source_key}</span>
      </div>
    </div>
  );
}

interface SuggestedActionsSectionProps {
  actions: AdvisorResponse["suggested_actions"];
}

function SuggestedActionsSection({ actions }: SuggestedActionsSectionProps) {
  return (
    <DashboardCard
      badge="Actions"
      title="Suggested Actions"
      caption="Read-only advice-only next steps. The advisor never executes actions — it only suggests the type of thinking the user should do next."
    >
      {actions.length === 0 ? (
        <EmptyState
          icon={<ChevronRight className="size-6" aria-hidden="true" />}
          title="No suggested actions"
          description="Add more profile data to surface richer advice."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {actions.map((action) => (
            <AdvisorActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Skeleton — mirrors the dashboard's skeleton grid so the
// loading transition feels native.
// --------------------------------------------------------------------------- //

function AdvisorSkeletonGrid() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <DashboardSkeleton rows={2} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
        </div>
        <DashboardSkeleton rows={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
        </div>
      </div>
    </PageContainer>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
