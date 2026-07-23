"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import {
  decisionService,
  dnaService,
  intelligenceService,
  rulesService,
  scoresService,
} from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  AIDecisionResponse,
  DnaResponse,
  IntelligenceResponse,
  RulesResponse,
  ScoresResponse,
} from "@/types/dashboard";

export interface DashboardData {
  intelligence: IntelligenceResponse | null;
  scores: ScoresResponse | null;
  dna: DnaResponse | null;
  rules: RulesResponse | null;
  decision: AIDecisionResponse | null;
}

export type DashboardDataState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

/**
 * Hook result. `refresh` is an explicit "invalidate-and-refetch"
 * for the bundled dashboard namespace — it does NOT create a
 * fresh state-machine cycle; the underlying queries just go
 * back to the loading state via the QueryClient.
 */
export interface UseDashboardDataResult {
  state: DashboardDataState;
  /** Force a fresh fetch of all five upstream payloads. */
  refresh: () => void;
  /** True while any of the five queries is fetching. */
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks.
// Each one maps a service call into a typed `useQuery`. They are exported
// (not just internal) so individual cards (e.g. the DNA card) can
// subscribe to a single endpoint without re-fetching the other four.
// --------------------------------------------------------------------------- //

export function useIntelligenceQuery() {
  return useQuery<IntelligenceResponse>({
    queryKey: queryKeys.intelligence(),
    queryFn: () => intelligenceService.analyze(),
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

export function useDecisionQuery() {
  return useQuery<AIDecisionResponse>({
    queryKey: queryKeys.decision(),
    queryFn: () => decisionService.compute(),
    // AI Decision is the only one that can legitimately be
    // 404 in this milestone (the others are guaranteed once a
    // business exists). Tolerate the missing case at the
    // query level so the dashboard still renders.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// --------------------------------------------------------------------------- //
// Bundled dashboard hook.
// --------------------------------------------------------------------------- //

/**
 * Loads the five dashboard payloads and surfaces a
 * discriminated union that the view can render directly.
 *
 * Sprint 4 update: the per-endpoint fetches are now wrapped
 * in TanStack Query. The public state-machine API is
 * preserved (loading / ready / no-business / error) so the
 * existing `DashboardView` and its sub-cards keep working
 * unchanged.
 *
 * Why a bundled hook: the dashboard is a single screen and
 * the spec calls for "Loading skeletons" / "Error states" /
 * "Empty state" — splitting per-endpoint would force the
 * view to re-implement the merge logic. The five requests
 * are independent so they fire in parallel.
 *
 * Caching semantics: with the shared QueryClient
 * (mounted at the (app) layout boundary), navigating away
 * from /dashboard and back within 30s renders instantly
 * from the cache; the user can also click "Refresh" to
 * force a fresh fetch via `refresh()`.
 */
export function useDashboardData(): UseDashboardDataResult {
  const intelligence = useIntelligenceQuery();
  const scores = useScoresQuery();
  const dna = useDnaQuery();
  const rules = useRulesQuery();
  const decision = useDecisionQuery();
  const queryClient = useQueryClient();

  const isFetching =
    intelligence.isFetching ||
    scores.isFetching ||
    dna.isFetching ||
    rules.isFetching ||
    decision.isFetching;

  // Find the first error among the five queries. We treat
  // decision 404 as "optional" — it doesn't promote the
  // overall state to error.
  const firstHardError = useMemo(() => {
    const candidates = [intelligence, scores, dna, rules];
    for (const q of candidates) {
      if (q.error) return q.error;
    }
    // Decision: ignore 404, surface anything else.
    if (
      decision.error &&
      !(decision.error instanceof ApiError && decision.error.status === 404)
    ) {
      return decision.error;
    }
    return null;
  }, [intelligence, scores, dna, rules, decision]);

  // no-business detection: any of the four "required" endpoints
  // returning a 404 with a "business" body is the canonical
  // signal that the user has not set up a profile yet.
  const noBusinessError = useMemo(() => {
    const candidates = [intelligence, scores, dna, rules];
    for (const q of candidates) {
      if (
        q.error instanceof ApiError &&
        q.error.status === 404
      ) {
        return q.error;
      }
    }
    return null;
  }, [intelligence, scores, dna, rules]);

  // Loading state: any of the four required queries is still
  // on its first fetch AND has no error. Once at least one
  // has succeeded we move to "ready" so the user can see
  // partial data even if one endpoint is down.
  const firstHardLoading =
    intelligence.isLoading ||
    scores.isLoading ||
    dna.isLoading ||
    rules.isLoading;

  const state: DashboardDataState = useMemo(() => {
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
          : "Could not load the dashboard.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    return {
      status: "ready",
      data: {
        intelligence: intelligence.data ?? null,
        scores: scores.data ?? null,
        dna: dna.data ?? null,
        rules: rules.data ?? null,
        decision: decision.data ?? null,
      },
    };
  }, [
    noBusinessError,
    firstHardError,
    firstHardLoading,
    intelligence.data,
    scores.data,
    dna.data,
    rules.data,
    decision.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}
