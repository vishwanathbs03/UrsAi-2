"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GrowthForecast } from "./GrowthForecast";
import { PredictionOverview } from "./PredictionOverview";
import { PredictiveFiltersBar } from "./PredictiveFiltersBar";
import { ProjectionCards } from "./ProjectionCards";
import { TimelineVisualization } from "./TimelineVisualization";
import { WhatDrivesGrowth } from "./WhatDrivesGrowth";
import {
  DEFAULT_PREDICTIVE_FILTERS,
  applyPredictiveFilters,
  type PredictiveFilters,
} from "./use-predictive-filters";
import { usePredictiveData } from "./use-predictive-data";

/**
 * Top-level Predictive Analytics view. The page renders
 * five sections (per the spec), in this order:
 *
 *   1. Page header with last-analysis timestamp + Refresh
 *   2. Prediction Overview       (4 KPI tiles)
 *   3. Growth Forecast           (multi-series line chart)
 *   4. Projection Cards          (4 deterministic cards)
 *   5. Filters + What Drives Growth (3 side-by-side panels)
 *   6. Timeline Visualization    (4 tabs + projection detail)
 *
 * The state machine (loading / no-business / error / ready)
 * is the same one used by every other analytics surface in
 * the app. The view renders it directly without wrapping.
 */
export function PredictiveAnalyticsView() {
  const { state, refresh, isFetching } = usePredictiveData();
  const [filters, setFilters] = useState<PredictiveFilters>(
    DEFAULT_PREDICTIVE_FILTERS,
  );

  const filteredRecommendations = useMemo(() => {
    if (state.status !== "ready") return [];
    return applyPredictiveFilters(
      state.data.recommendations.recommendations,
      filters,
    );
  }, [state, filters]);

  // If the user changes filters after a refresh lands,
  // make sure the filter state stays in sync (e.g. resetting
  // to defaults when the upstream returned an empty
  // recommendation list).
  useEffect(() => {
    if (state.status !== "ready") return;
    if (
      filters.priority !== "all" &&
      !state.data.recommendations.recommendations.some(
        (r) => r.priority === filters.priority,
      )
    ) {
      // No recommendation matches the priority filter;
      // the panel will render its own "no match" hint
      // rather than resetting user intent.
    }
  }, [state, filters]);

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
          <DashboardSkeleton rows={4} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardSkeleton rows={3} />
            <DashboardSkeleton rows={3} />
            <DashboardSkeleton rows={3} />
            <DashboardSkeleton rows={3} />
          </div>
          <DashboardSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          icon={<Building2 className="size-6" aria-hidden="true" />}
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to see 12-month deterministic projections."
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
          title="Could not load predictive analytics"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { twin, recommendations } = state.data;
  const lastAnalyzedAt =
    twin.last_analysis_at || twin.generated_at || null;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <PageHeader
          lastAnalyzedAt={lastAnalyzedAt}
          isFetching={isFetching}
          onRefresh={refresh}
        />

        <PredictionOverview twin={twin} />

        <GrowthForecast twin={twin} timeline={filters.timeline} />

        <ProjectionCards twin={twin} />

        <PredictiveFiltersBar
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredRecommendations.length}
          totalCount={recommendations.recommendations.length}
        />

        <WhatDrivesGrowth
          twin={twin}
          recommendations={recommendations.recommendations}
          filters={filters}
        />

        <TimelineVisualization twin={twin} />
      </div>
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
      badge="Predictive Analytics"
      title="Predictive Analytics"
      caption="12-month deterministic projections derived from the Digital Twin, Roadmap, and Recommendations."
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing predictive analytics" : "Refresh predictive analytics"}
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
          <Building2 className="size-3.5 text-primary" aria-hidden="true" />
          Last analysis
        </span>
        <span className="font-mono text-foreground">
          {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "—"}
        </span>
      </div>
    </DashboardCard>
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
