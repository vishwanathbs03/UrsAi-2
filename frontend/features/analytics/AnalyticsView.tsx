"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { MaturityRadarChart } from "./MaturityRadarChart";
import { SchemeEligibilityChart } from "./SchemeEligibilityChart";
import { RuleForecastCard } from "./RuleForecastCard";
import { useAnalyticsData } from "./use-analytics-data";
import {
  applyRecommendationFilters,
  DEFAULT_ANALYTICS_FILTERS,
  type AnalyticsFilters,
} from "./use-analytics-filters";

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
          illustration="building"
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to view executive analytics, trends, and opportunity insights."
          }
          actionLabel="Create business profile"
          onAction={() => {
            if (typeof window !== "undefined") window.location.href = "/business";
          }}
          secondaryActionLabel="How it works"
          onSecondaryAction={() => {
            if (typeof window !== "undefined") window.location.href = "/";
          }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business Profile
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
          title="Could not load executive analytics"
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
      <div className="flex flex-col gap-6 py-2 animate-in fade-in duration-300">
        {/* Top Header & Export Controls */}
        <AnalyticsHeader
          lastAnalyzedAt={lastAnalyzedAt}
          onRefresh={refresh}
          isRefreshing={isFetching}
        />

        {/* Filter Controls Bar */}
        <AnalyticsFiltersBar
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredRecommendations.length}
          totalCount={recommendations.recommendations.length}
        />

        {/* Top KPI Cards Grid */}
        <OverviewCards data={state.data} />

        {/* Hero Visualizations Grid 1: Score Trends & Maturity Radar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ScoreTrendsChart data={state.data} />
          <MaturityRadarChart data={state.data} />
        </div>

        {/* Hero Visualizations Grid 2: Government Scheme Eligibility & Rule Forecast */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SchemeEligibilityChart />
          <RuleForecastCard data={state.data} />
        </div>

        {/* Operational Pillar Readiness Breakdown */}
        <ReadinessBreakdown data={state.data} />

        {/* Recommendation Priority & Category Breakdown */}
        <RecommendationAnalytics
          items={filteredRecommendations}
          totalCount={recommendations.recommendations.length}
        />

        {/* Roadmap Projections */}
        <RoadmapAnalytics data={state.data} />

        {/* Risk & Opportunity Matrix Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RiskAnalytics matrix={twin.risk_matrix} />
          <OpportunityAnalytics matrix={twin.opportunity_matrix} />
        </div>
      </div>
    </PageContainer>
  );
}
