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

export interface AnalyticsData {
  twin: TwinResponse;
  roadmap: RoadmapResponse;
  recommendations: RecommendationsResponse;
}

export type AnalyticsDataState =
  | { status: "loading" }
  | { status: "ready"; data: AnalyticsData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseAnalyticsDataResult {
  state: AnalyticsDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks.
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
// Bundled analytics hook.
// --------------------------------------------------------------------------- //

/**
 * Loads the three analytics payloads (twin, roadmap,
 * recommendations) in parallel and surfaces a
 * discriminated union the view can render directly.
 */
export function useAnalyticsData(): UseAnalyticsDataResult {
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

  const state: AnalyticsDataState = useMemo(() => {
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
          : "Could not load analytics.";
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.twin() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.roadmap() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}

/**
 * Estimate current profile completion from twin identity +
 * profile summary when the wizard is not marked complete.
 */
export function computeProfileCompletion(twin: TwinResponse): number {
  if (twin.identity.is_completed) return 100;
  const checks = [
    twin.profile.has_website,
    twin.profile.has_ecommerce,
    twin.profile.uses_digital_marketing,
    twin.profile.uses_cloud_systems,
    twin.profile.has_active_certification,
    twin.profile.has_iec_number,
    twin.profile.products_count > 0,
    twin.profile.goals_count > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/** Readiness pillar keys shown in the analytics breakdown. */
export const READINESS_KEYS = [
  "digital",
  "export",
  "compliance",
  "growth",
  "innovation",
  "sustainability",
] as const;

export function scoreByKey(
  twin: TwinResponse,
  key: string,
): { title: string; score: number; level: string } | null {
  const found = twin.scores.scores.find((s) => s.key === key);
  if (!found) return null;
  return { title: found.title, score: found.score, level: found.level };
}
