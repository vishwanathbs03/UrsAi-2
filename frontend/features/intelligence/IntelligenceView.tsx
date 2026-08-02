"use client";

/**
 * Business Digital Twin — H5.1 single-screen experience.
 *
 * Replaces the previous multi-card intelligence dashboard. The
 * page answers two user questions:
 *   1. "What is the current state of my business?"
 *   2. "What should I do next?"
 *
 * Sources (no new APIs):
 *   - `useIntelligence()` → /api/v1/business/intelligence
 *   - `useTwinQuery()`    → /api/v1/business/twin
 *   - `useRecommendationsQuery()` → /api/v1/business/recommendations
 *   - `useQuery([government-schemes], …)` → /api/v1/business/schemes
 *
 * Sections (1–8) live in `./twin-sections/`. This file is the
 * orchestrator: it owns data fetching + skeleton + error states
 * + the two-question banner + section ordering.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useIntelligence } from "@/hooks/useIntelligence";
import { useTwinQuery, useRecommendationsQuery } from "@/features/analytics/use-analytics-data";
import { schemesService } from "@/services/schemes-service";
import type { IntelligenceAnalyzer } from "@/types/dashboard";
import { AIBusinessBrief } from "./twin-sections/AIBusinessBrief";
import { BusinessSnapshot } from "./twin-sections/BusinessSnapshot";
import { BusinessHealth } from "./twin-sections/BusinessHealth";
import { BusinessReadiness } from "./twin-sections/BusinessReadiness";
import { TopStrengths } from "./twin-sections/TopStrengths";
import { TopRisks } from "./twin-sections/TopRisks";
import { TopOpportunities } from "./twin-sections/TopOpportunities";
import { TopNextActions } from "./twin-sections/TopNextActions";
import { GovernmentOpportunity } from "./twin-sections/GovernmentOpportunity";
import { AssistantConnector } from "./twin-sections/AssistantConnector";

function pickLowestDimension(analyzers: IntelligenceAnalyzer[] | undefined): { label: string; score: number } | null {
  if (!analyzers || analyzers.length === 0) return null;
  const sorted = [...analyzers].sort((a, b) => a.score - b.score);
  const lo = sorted[0];
  if (!lo) return null;
  return { label: lo.title, score: lo.score };
}

export const IntelligenceView: React.FC = () => {
  const twinQuery = useTwinQuery();
  const intelligenceQuery = useIntelligence();
  const recommendationsQuery = useRecommendationsQuery();
  const schemesQuery = useQuery({
    queryKey: ["government-schemes"],
    queryFn: () => schemesService.getSchemes(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const anyLoading =
    twinQuery.isLoading || intelligenceQuery.isLoading || recommendationsQuery.isLoading;
  const anyError =
    twinQuery.isError || intelligenceQuery.isError || recommendationsQuery.isError;

  // Common loading skeleton — visual continuity with the rest of the app.
  if (anyLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8">
        <div className="h-8 w-72 rounded bg-muted/60" />
        <div className="h-4 w-96 rounded bg-muted/40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-card border border-border/50" />
        ))}
      </div>
    );
  }

  // Profile-missing fallback. Only show if the twin is genuinely 404.
  const isTwin404 =
    twinQuery.isError &&
    ((twinQuery.error as { status?: number } | null)?.status === 404 ||
      (twinQuery.error?.message || "").includes("404"));

  if (isTwin404) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center bg-card">
        <div className="rounded-full bg-muted p-4 text-muted-foreground">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-bold text-card-foreground">No Business Profile Found</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          Please complete your business profile to generate your Business Digital Twin.
        </p>
        <a
          href="/business"
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
        >
          Complete Profile
        </a>
      </div>
    );
  }

  if (anyError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
          Failed to Load Business Digital Twin
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {String((twinQuery.error || intelligenceQuery.error || recommendationsQuery.error)?.message || "")}
        </p>
        <button
          onClick={() => {
            twinQuery.refetch();
            intelligenceQuery.refetch();
            recommendationsQuery.refetch();
          }}
          className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const twin = twinQuery.data ?? null;
  const intelligence = intelligenceQuery.data ?? null;
  const recommendations = recommendationsQuery.data ?? null;
  const schemes = schemesQuery.data ?? null;
  const lowestDimension = pickLowestDimension(intelligence?.analyzers);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Two-question hero banner — the brief requires this
          question-first framing. */}
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Business Digital Twin
        </span>
        <h1 className="mt-1 text-3xl font-extrabold text-foreground tracking-tight">
          What is the current state of my business?
        </h1>
        <p className="mt-1 text-sm font-semibold text-primary">
          What should I do next? See your top three moves below.
        </p>
      </header>

      {/* Section 9 — AI Business Brief (executive summary, renders first) */}
      <AIBusinessBrief twin={twin} intelligence={intelligence} recommendations={recommendations} />

      {/* Section 1 — Business Snapshot */}
      <BusinessSnapshot twin={twin} />

      {/* Section 2 — Business Health */}
      <BusinessHealth intelligence={intelligence} />

      {/* Section 3 — Business Readiness */}
      <BusinessReadiness intelligence={intelligence} />

      {/* Section 7 — Top 3 Next Actions (placed before strengths/risks/opportunities
          so the user's "what next?" question is answered before they read context) */}
      <TopNextActions recommendations={recommendations} lowestDimension={lowestDimension} />

      {/* Section 4 — Top Strengths */}
      <TopStrengths intelligence={intelligence} />

      {/* Section 5 — Top Risks */}
      <TopRisks intelligence={intelligence} />

      {/* Section 6 — Top Opportunities */}
      <TopOpportunities intelligence={intelligence} />

      {/* Section 8 — Government Opportunity */}
      <GovernmentOpportunity twin={twin} schemes={schemes} isLoadingSchemes={schemesQuery.isLoading} />

      {/* Section 10 — Connect to AI Assistant (handoff at the end) */}
      <AssistantConnector twin={twin} intelligence={intelligence} schemes={schemes} />

      <footer className="pt-2 text-center text-[11px] italic text-muted-foreground">
        All values shown are derived from your live business profile and the rule engine.
        Where data is unavailable, the page explicitly says so — never fabricated.
      </footer>
    </div>
  );
};
