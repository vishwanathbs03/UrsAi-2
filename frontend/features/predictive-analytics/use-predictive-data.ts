"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import {
  recommendationsService,
  roadmapService,
  twinService,
} from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  RecommendationsResponse,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";

// --------------------------------------------------------------------------- //
// Bundled data
// --------------------------------------------------------------------------- //

export interface PredictiveData {
  twin: TwinResponse;
  roadmap: RoadmapResponse;
  recommendations: RecommendationsResponse;
}

export type PredictiveDataState =
  | { status: "loading" }
  | { status: "ready"; data: PredictiveData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UsePredictiveDataResult {
  state: PredictiveDataState;
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

// --------------------------------------------------------------------------- //
// Bundled predictive-analytics hook
// --------------------------------------------------------------------------- //

/**
 * Loads the three upstream payloads (twin, roadmap,
 * recommendations) and exposes the same loading / no-business
 * / error / ready state machine used by every other analytics
 * surface in the app.
 *
 * The view does all of the deterministic projection joining
 * off of `twin.timeline` (which already carries the
 * 0/3/6/12-month points the engine computed) — this hook is
 * intentionally a thin pass-through, not a derivation layer.
 */
export function usePredictiveData(): UsePredictiveDataResult {
  const twin = useTwinQuery();
  const roadmap = useRoadmapQuery();
  const recommendations = useRecommendationsQuery();
  const queryClient = useQueryClient();

  const isFetching =
    twin.isFetching || roadmap.isFetching || recommendations.isFetching;

  const noBusinessError = useMemo(() => {
    const candidates = [twin, roadmap, recommendations];
    for (const q of candidates) {
      if (q.error instanceof ApiError && q.error.status === 404) {
        return q.error;
      }
    }
    return null;
  }, [twin.error, roadmap.error, recommendations.error]);

  const firstHardError = useMemo(() => {
    for (const q of [twin, roadmap, recommendations]) {
      if (q.error) return q.error;
    }
    return null;
  }, [twin.error, roadmap.error, recommendations.error]);

  const firstHardLoading =
    twin.isLoading || roadmap.isLoading || recommendations.isLoading;

  const state: PredictiveDataState = useMemo(() => {
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
          : "Could not load predictive analytics.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (!twin.data || !roadmap.data || !recommendations.data) {
      return { status: "loading" };
    }
    return {
      status: "ready",
      data: {
        twin: twin.data,
        roadmap: roadmap.data,
        recommendations: recommendations.data,
      },
    };
  }, [
    noBusinessError,
    firstHardError,
    firstHardLoading,
    twin.data,
    roadmap.data,
    recommendations.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.twin() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.roadmap() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}

// --------------------------------------------------------------------------- //
// Pure derivations (kept here so all sections agree)
// --------------------------------------------------------------------------- //

/**
 * Names of the four readiness pillars the engine projects
 * forward in `twin.timeline.*.projected_*_score`. Used by
 * the Growth Forecast "Readiness Trend" series and the
 * Timeline tab detail.
 */
export const PROJECTED_PILLAR_KEYS = [
  "projected_digital_score",
  "projected_compliance_score",
  "projected_export_score",
  "projected_growth_score",
] as const;

/**
 * Average the four projected readiness pillars at a given
 * timeline point. Used for the Growth Forecast series.
 */
export function averageProjectedReadiness(
  projection: TwinResponse["timeline"]["current"],
): number {
  const values = PROJECTED_PILLAR_KEYS.map(
    (k) => Number(projection[k] ?? 0) || 0,
  );
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Average the four *current* readiness pillars from
 * `twin.health_summary` to seed the "Current" point of the
 * Readiness Trend. The other three timeline points use
 * `averageProjectedReadiness` instead.
 */
export function averageCurrentReadiness(twin: TwinResponse): number {
  const values = [
    twin.health_summary.digital_maturity,
    twin.health_summary.compliance_readiness,
    twin.health_summary.export_readiness,
    twin.health_summary.growth_readiness,
  ];
  const sum = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return Math.round((sum / values.length) * 10) / 10;
}
