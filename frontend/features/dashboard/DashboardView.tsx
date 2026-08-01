"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDashboardEndpointData } from "./use-dashboard-endpoint-data";
import { DashboardHeader } from "./DashboardHeader";
import { KPIGrid } from "./KPIGrid";
import { HealthScoreCard } from "./HealthScoreCard";
import { AISummaryCard } from "./AISummaryCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { GovernmentSchemesWidget } from "./GovernmentSchemesWidget";
import { ReportsWidget } from "./ReportsWidget";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";

export function DashboardView() {
  const { state, refresh, isFetching } = useDashboardEndpointData();

  if (state.status === "loading") return <DashboardSkeletonGrid />;

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <div className="py-8 animate-in fade-in duration-300">
          <EmptyState
            illustration="building"
            title="No business profile yet"
            description={
              state.detail ||
              "Set up your business profile to view metrics, health scores, and AI summaries."
            }
            actionLabel="Create business profile"
            onAction={() => {
              if (typeof window !== "undefined") window.location.href = "/business";
            }}
            secondaryActionLabel="See assistant"
            onSecondaryAction={() => {
              if (typeof window !== "undefined") window.location.href = "/assistant";
            }}
          />
          <div className="mt-6 flex items-center justify-center">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/business">
                Go to Business Profile
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <div className="py-8 animate-in fade-in duration-300">
          <ErrorState
            title="Could not load the executive dashboard"
            description={state.detail}
            actionLabel="Try again"
            onAction={refresh}
          />
        </div>
      </PageContainer>
    );
  }

  const { data } = state;
  const business = data.business;
  const kpis = data.kpis || {};
  const healthScore = data.healthScore ?? data.health_score ?? 85;
  const aiSummary =
    data.aiSummary ||
    data.ai_summary ||
    "Business operations are active and running within expected parameters.";
  const recentActivity = data.recentActivity || data.recent_activity || [];

  return (
    <PageContainer width="wide">
      <main
        className="flex flex-col gap-6 md:gap-8 py-2 animate-in fade-in duration-300"
        aria-label="Executive Business Intelligence Dashboard"
      >
        {/* Top Welcome Briefing Section */}
        <DashboardHeader
          lastAnalyzedAt={business?.updated_at || null}
          onRefresh={refresh}
          isRefreshing={isFetching}
        />

        {/* Hero Score & AI Summary */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Executive Briefing">
          <HealthScoreCard score={healthScore} />
          <AISummaryCard summary={aiSummary} kpis={kpis} healthScore={healthScore} />
        </section>

        {/* Key Performance Indicators Grid */}
        <section className="flex flex-col gap-3" aria-label="Key Performance Indicators">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Key Performance Indicators & Parameters
            </h2>
          </div>
          <KPIGrid kpis={kpis} />
        </section>

        {/* Government Schemes & Capital Opportunities */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Opportunities & Exports">
          <GovernmentSchemesWidget />
          <ReportsWidget />
        </section>

        {/* Recent Activity & Quick Shortcuts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Activity and Quick Actions">
          <RecentActivityCard activities={recentActivity} />
          <QuickActionsCard
            businessExists={Boolean(business)}
            profileCompletion={kpis.profileCompletion ?? kpis.profile_completion ?? 0}
            healthScore={healthScore}
          />
        </section>
      </main>
    </PageContainer>
  );
}

function DashboardSkeletonGrid() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-6 md:gap-8 py-2 animate-in fade-in duration-200">
        <DashboardSkeleton rows={2} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
        </div>
        <DashboardSkeleton rows={4} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={3} />
        </div>
      </div>
    </PageContainer>
  );
}
