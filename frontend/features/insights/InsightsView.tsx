"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Lightbulb, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InsightsOverview } from "./InsightsOverview";
import { InsightsFiltersBar } from "./InsightsFiltersBar";
import { InsightsList } from "./InsightsList";
import { InsightDetailPanel } from "./InsightDetailPanel";
import {
  applyInsightFilters,
  DEFAULT_INSIGHTS_FILTERS,
  INSIGHT_CATEGORIES,
  type InsightsFilters,
} from "./use-insights-filters";
import { useInsightsData, type InsightItem } from "./use-insights-data";

/**
 * Top-level Insights Center view.
 *
 * The page renders four sections:
 *   1. Page header — last-analysed timestamp + Refresh
 *   2. Overview — four KPI tiles (Health / Confidence / Archetype / Total)
 *   3. Filter bar — category, priority, confidence, text search
 *   4. List — responsive grid of insight cards + a slide-over
 *      detail panel that opens when a card is clicked.
 *
 * The `loading / no-business / error / ready` state machine is
 * the same one used by the dashboard / analytics / action-board /
 * reports hooks — `useInsightsData` is a thin bundle on top of
 * the existing services.
 */
export function InsightsView() {
  const { state, refresh, isFetching } = useInsightsData();
  const [filters, setFilters] = useState<InsightsFilters>(
    DEFAULT_INSIGHTS_FILTERS,
  );
  const [openInsight, setOpenInsight] = useState<InsightItem | null>(null);

  // Reset the open detail when the underlying data is replaced
  // (e.g. after a refresh) so the panel never shows a stale
  // reference.
  useEffect(() => {
    if (state.status !== "ready") {
      setOpenInsight(null);
    }
  }, [state]);

  const filteredInsights = useMemo(() => {
    if (state.status !== "ready") return [] as InsightItem[];
    return applyInsightFilters(state.data.insights, filters);
  }, [state, filters]);

  const handleOpen = useCallback((insight: InsightItem) => {
    setOpenInsight(insight);
  }, []);
  const handleClose = useCallback(() => {
    setOpenInsight(null);
  }, []);

  if (state.status === "loading") {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-4">
          <DashboardSkeleton rows={2} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
          </div>
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="building"
          title="No business profile yet"
          description={state.detail ||
            "Set up your business profile to unlock the AI insights engine."
          }
          actionLabel="Create business profile"
          onAction={() => { if (typeof window !== "undefined") window.location.href = "/business"; }}
          secondaryActionLabel="Explore the dashboard"
          onSecondaryAction={() => { if (typeof window !== "undefined") window.location.href = "/dashboard"; }}
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
          title="Could not load insights"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { decision, insights } = state.data;
  const lastAnalyzedAt = decision.generated_at || null;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <PageHeader
          lastAnalyzedAt={lastAnalyzedAt}
          isFetching={isFetching}
          onRefresh={refresh}
        />
        <InsightsOverview data={state.data} />
        <CategoryStrip
          total={insights.length}
          visible={filteredInsights.length}
        />
        <InsightsFiltersBar
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredInsights.length}
          totalCount={insights.length}
        />
        <InsightsList
          insights={filteredInsights}
          totalCount={insights.length}
          onOpen={handleOpen}
        />
      </div>

      <InsightDetailPanel insight={openInsight} onClose={handleClose} />
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Internal sub-components
// --------------------------------------------------------------------------- //

interface PageHeaderProps {
  lastAnalyzedAt: string | null;
  isFetching: boolean;
  onRefresh: () => void;
}

function PageHeader({ lastAnalyzedAt, isFetching, onRefresh }: PageHeaderProps) {
  return (
    <DashboardCard
      badge="Insights"
      title="Insights Center"
      caption="AI-derived business insights, joined with the matching rule firings, recommendations, and roadmap items."
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing insights" : "Refresh insights"}
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
          <Lightbulb className="size-3.5 text-primary" aria-hidden="true" />
          Last analysis
        </span>
        <span className="font-mono text-foreground">
          {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "—"}
        </span>
      </div>
    </DashboardCard>
  );
}

function CategoryStrip({ total, visible }: { total: number; visible: number }) {
  return (
    <div
      role="list"
      aria-label="Insight categories"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {INSIGHT_CATEGORIES.map((c) => (
        <div
          key={c.key}
          role="listitem"
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {c.label}
          </p>
          <p className="text-xs text-foreground/80 line-clamp-2">
            {c.description}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {visible} of {total} insights shown
          </p>
        </div>
      ))}
    </div>
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
