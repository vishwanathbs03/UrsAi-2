"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import {
  decisionService,
  dnaService,
  intelligenceService,
  recommendationsService,
  roadmapService,
  rulesService,
  scoresService,
  twinService,
} from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  AIDecisionResponse,
  DnaResponse,
  IntelligenceResponse,
  RulesResponse,
  ScoresResponse,
} from "@/types/dashboard";
import type {
  RecommendationsResponse,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";

// --------------------------------------------------------------------------- //
// Bundle shape
// --------------------------------------------------------------------------- //

/**
 * Reports view bundle — every existing analytical payload in one
 * discriminated-union-friendly object. Each field is nullable
 * because individual queries may be in-flight or errored; the
 * bundled hook surfaces the canonical "no-business / error /
 * loading / ready" state so the view can render one of three
 * pre-built chrome states.
 */
export interface ReportsData {
  twin: TwinResponse;
  roadmap: RoadmapResponse;
  recommendations: RecommendationsResponse;
  scores: ScoresResponse;
  dna: DnaResponse;
  rules: RulesResponse;
  intelligence: IntelligenceResponse;
  decision: AIDecisionResponse | null;
}

export type ReportsDataState =
  | { status: "loading" }
  | { status: "ready"; data: ReportsData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseReportsDataResult {
  state: ReportsDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks
// --------------------------------------------------------------------------- //

export function useTwinQuery() {
  return useQuery<TwinResponse>({
    queryKey: queryKeys.twin(),
    queryFn: () => twinService.compute(),
  });
}

export function useRoadmapQuery() {
  return useQuery<RoadmapResponse>({
    queryKey: queryKeys.roadmap(),
    queryFn: () => roadmapService.compute(),
  });
}

export function useRecommendationsQuery() {
  return useQuery<RecommendationsResponse>({
    queryKey: queryKeys.recommendations(),
    queryFn: () => recommendationsService.compute(),
  });
}

export function useScoresQuery() {
  return useQuery<ScoresResponse>({
    queryKey: queryKeys.scores(),
    queryFn: () => scoresService.compute(),
  });
}

export function useDnaQuery() {
  return useQuery<DnaResponse>({
    queryKey: queryKeys.dna(),
    queryFn: () => dnaService.compute(),
  });
}

export function useRulesQuery() {
  return useQuery<RulesResponse>({
    queryKey: queryKeys.rules(),
    queryFn: () => rulesService.compute(),
  });
}

export function useIntelligenceQuery() {
  return useQuery<IntelligenceResponse>({
    queryKey: queryKeys.intelligence(),
    queryFn: () => intelligenceService.analyze(),
  });
}

export function useDecisionQuery() {
  return useQuery<AIDecisionResponse>({
    queryKey: queryKeys.decision(),
    queryFn: () => decisionService.compute(),
    // AI Decision can legitimately 404 in the current milestone.
    // Tolerate that; surface anything else.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// --------------------------------------------------------------------------- //
// Bundled reports hook
// --------------------------------------------------------------------------- //

/**
 * Loads every analytical payload in parallel and exposes the
 * canonical loading / ready / no-business / error state.
 *
 * The seven required queries fan out in parallel; the bundled
 * hook waits for the seven "required" payloads (twin, roadmap,
 * recommendations, scores, dna, rules, intelligence) and treats
 * the AI decision as optional (its 404 is non-fatal, same as in
 * the dashboard and action-board hooks).
 *
 * Caching semantics: with the shared QueryClient mounted at the
 * (app) layout boundary, every per-endpoint cache is reused from
 * the dashboard / analytics / action-board visits. Refreshing the
 * reports page refetches the same keys, so the user never pays
 * for the same upstream payload twice in a session.
 */
export function useReportsData(): UseReportsDataResult {
  const twin = useTwinQuery();
  const roadmap = useRoadmapQuery();
  const recommendations = useRecommendationsQuery();
  const scores = useScoresQuery();
  const dna = useDnaQuery();
  const rules = useRulesQuery();
  const intelligence = useIntelligenceQuery();
  const decision = useDecisionQuery();
  const queryClient = useQueryClient();

  const isFetching =
    twin.isFetching ||
    roadmap.isFetching ||
    recommendations.isFetching ||
    scores.isFetching ||
    dna.isFetching ||
    rules.isFetching ||
    intelligence.isFetching ||
    decision.isFetching;

  const noBusinessError = useMemo(() => {
    const candidates = [
      twin,
      roadmap,
      recommendations,
      scores,
      dna,
      rules,
      intelligence,
    ];
    for (const q of candidates) {
      if (q.error instanceof ApiError && q.error.status === 404) {
        return q.error;
      }
    }
    return null;
  }, [
    twin.error,
    roadmap.error,
    recommendations.error,
    scores.error,
    dna.error,
    rules.error,
    intelligence.error,
  ]);

  const firstHardError = useMemo(() => {
    const required = [
      twin,
      roadmap,
      recommendations,
      scores,
      dna,
      rules,
      intelligence,
    ];
    for (const q of required) {
      if (q.error) return q.error;
    }
    if (
      decision.error &&
      !(decision.error instanceof ApiError && decision.error.status === 404)
    ) {
      return decision.error;
    }
    return null;
  }, [
    twin.error,
    roadmap.error,
    recommendations.error,
    scores.error,
    dna.error,
    rules.error,
    intelligence.error,
    decision.error,
  ]);

  const firstHardLoading =
    twin.isLoading ||
    roadmap.isLoading ||
    recommendations.isLoading ||
    scores.isLoading ||
    dna.isLoading ||
    rules.isLoading ||
    intelligence.isLoading;

  const state: ReportsDataState = useMemo(() => {
    if (noBusinessError) {
      const detail =
        typeof noBusinessError.body === "object" &&
        noBusinessError.body &&
        "detail" in noBusinessError.body
          ? String((noBusinessError.body as { detail: unknown }).detail)
          : "No business profile to evaluate.";
      return { status: "no-business", detail };
    }
    if (firstHardError) {
      const message =
        firstHardError instanceof Error
          ? firstHardError.message
          : "Could not load the report.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (
      !twin.data ||
      !roadmap.data ||
      !recommendations.data ||
      !scores.data ||
      !dna.data ||
      !rules.data ||
      !intelligence.data
    ) {
      return { status: "loading" };
    }
    return {
      status: "ready",
      data: {
        twin: twin.data,
        roadmap: roadmap.data,
        recommendations: recommendations.data,
        scores: scores.data,
        dna: dna.data,
        rules: rules.data,
        intelligence: intelligence.data,
        decision: decision.data ?? null,
      },
    };
  }, [
    noBusinessError,
    firstHardError,
    firstHardLoading,
    twin.data,
    roadmap.data,
    recommendations.data,
    scores.data,
    dna.data,
    rules.data,
    intelligence.data,
    decision.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionBoardAll() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}
