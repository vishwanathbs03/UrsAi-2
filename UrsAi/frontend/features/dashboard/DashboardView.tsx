"use client";

import { useDashboardData } from "./use-dashboard-data";
import { DashboardHeader } from "./DashboardHeader";
import { OverallHealthCard } from "./OverallHealthCard";
import { DnaCard } from "./DnaCard";
import { ReadinessCard } from "./ReadinessCard";
import { ScoresRadarCard } from "./ScoresRadarCard";
import { SwotSummaryCard } from "./SwotSummaryCard";
import { AiDecisionCard } from "./AiDecisionCard";
import { RecentAnalysisCard } from "./RecentAnalysisCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

/**
 * Main dashboard view. Owns:
 *  * the data hook
 *  * the loading skeleton grid
 *  * the empty state (no business)
 *  * the error state
 *  * the success grid: Welcome / Health / DNA / Readiness /
 *    Radar / SWOT / AI / Recency
 *
 * The view is the only place that decides which of the eight
 * cards to render. Each card is independently responsible for
 * its own loading / error / empty sub-states.
 *
 * Sprint 4 update: the underlying hook now uses TanStack
 * Query. The view subscribes to `isFetching` to render a
 * subtle "refreshing" indicator in the header while a
 * background re-fetch is in flight.
 */
export function DashboardView() {
  const { state, refresh, isFetching } = useDashboardData();

  if (state.status === "loading") return <DashboardSkeletonGrid />;

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to see intelligence, scores, DNA, rules, and AI decisions here."
          }
          icon={<Building2 className="size-6" aria-hidden="true" />}
          actionLabel="Create business profile"
          onAction={() => {
            // Best-effort navigation; the business route is a
            // placeholder page in this milestone, so the link is
            // a soft hint.
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
          title="Could not load the dashboard"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { intelligence, scores, dna, rules, decision } = state.data;
  const intelligenceOverall = intelligence?.overall?.score ?? 0;
  const intelligenceLevel = intelligence?.overall?.level ?? "low";
  const lastAnalyzedAt =
    intelligence?.generated_at ??
    scores?.generated_at ??
    dna?.generated_at ??
    rules?.generated_at ??
    decision?.generated_at ??
    null;

  return (
    <PageContainer width="wide">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3">
          <DashboardHeader
            lastAnalyzedAt={lastAnalyzedAt}
            onRefresh={refresh}
            isRefreshing={isFetching}
          />
        </div>

        <OverallHealthCard
          intelligenceScore={intelligenceOverall}
          intelligenceLevel={intelligenceLevel}
          scores={scores}
        />
        <DnaCard dna={dna} />
        <RecentAnalysisCard
          intelligenceAt={intelligence?.generated_at ?? null}
          scoresAt={scores?.generated_at ?? null}
          dnaAt={dna?.generated_at ?? null}
          rulesAt={rules?.generated_at ?? null}
          decisionAt={decision?.generated_at ?? null}
        />

        <ReadinessCard scores={scores?.scores ?? []} />
        <ScoresRadarCard scores={scores?.scores ?? []} />

        <div className="md:col-span-2 xl:col-span-2">
          <SwotSummaryCard
            strengths={dna?.dna?.strengths ?? []}
            weaknesses={dna?.dna?.weaknesses ?? []}
            opportunities={dna?.dna?.opportunities ?? []}
            risks={dna?.dna?.risk_areas ?? []}
          />
        </div>

        {decision && (
          <div className="md:col-span-2 xl:col-span-3">
            <AiDecisionCard
              decision={decision.decision}
              model={decision.inputs.model}
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function DashboardSkeletonGrid() {
  return (
    <PageContainer width="wide">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3">
          <DashboardSkeleton rows={2} />
        </div>
        <DashboardSkeleton rows={4} />
        <DashboardSkeleton rows={3} />
        <DashboardSkeleton rows={5} />
        <DashboardSkeleton rows={3} />
        <DashboardSkeleton rows={4} />
        <DashboardSkeleton rows={2} />
        <div className="md:col-span-2 xl:col-span-3">
          <DashboardSkeleton rows={6} />
        </div>
      </div>
    </PageContainer>
  );
}
