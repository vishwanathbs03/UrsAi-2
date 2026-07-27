"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { AnalyticsFiltersBar } from "./AnalyticsFiltersBar";
import { AnalyticsHeader } from "./AnalyticsHeader";
import { AnalyticsSkeletonGrid } from "./AnalyticsSkeleton";
import { OpportunityAnalytics } from "./OpportunityAnalytics";
import { OverviewCards } from "./OverviewCards";
import { ReadinessBreakdown } from "./ReadinessBreakdown";
import { RecommendationAnalytics } from "./RecommendationAnalytics";
import { RiskAnalytics } from "./RiskAnalytics";
import { RoadmapAnalytics } from "./RoadmapAnalytics";
import { ScoreTrendsChart } from "./ScoreTrendsChart";
import { useAnalyticsData } from "./use-analytics-data";
import {
  applyRecommendationFilters,
  DEFAULT_ANALYTICS_FILTERS,
  type AnalyticsFilters,
} from "./use-analytics-filters";

/**
 * Main analytics view — aggregates twin, roadmap, and
 * recommendations into a responsive analytics dashboard.
 */
export function AnalyticsView() {
  const { state, refresh, isFetching } = useAnalyticsData();
  const [filters, setFilters] = useState<AnalyticsFilters>(
    DEFAULT_ANALYTICS_FILTERS,
  );

  const filteredRecommendations = useMemo(() => {
    if (state.status !== "ready") return [];
    return applyRecommendationFilters(
      state.data.recommendations.recommendations,
      filters,
    );
  }, [state, filters]);

  if (state.status === "loading") return <AnalyticsSkeletonGrid />;

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to see analytics, trends, and opportunity insights."
          }
          icon={<Building2 className="size-6" aria-hidden="true" />}
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
          title="Could not load analytics"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { twin, recommendations } = state.data;
  const lastAnalyzedAt =
    twin.last_analysis_at ?? twin.generated_at ?? recommendations.generated_at;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <AnalyticsHeader
          lastAnalyzedAt={lastAnalyzedAt}
          onRefresh={refresh}
          isRefreshing={isFetching}
        />

        <AnalyticsFiltersBar
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredRecommendations.length}
          totalCount={recommendations.recommendations.length}
        />

        <OverviewCards data={state.data} />
        <ReadinessBreakdown data={state.data} />
        <ScoreTrendsChart data={state.data} />
        <RecommendationAnalytics
          items={filteredRecommendations}
          totalCount={recommendations.recommendations.length}
        />
        <RoadmapAnalytics data={state.data} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RiskAnalytics matrix={twin.risk_matrix} />
          <OpportunityAnalytics matrix={twin.opportunity_matrix} />
        </div>
      </div>
    </PageContainer>
  );
}
