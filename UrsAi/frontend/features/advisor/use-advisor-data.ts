"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import { advisorService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type { AdvisorResponse } from "@/types/advisor";

/**
 * Bundled hook for the Autonomous Business Advisor.
 *
 * The advisor is a read-only aggregator over the five
 * existing upstream payloads (Twin, Rules, Recommendations,
 * Roadmap, AI Decision / Insights). The state machine is
 * the same `loading / ready / no-business / error` shape
 * used by every other analytics surface in the app —
 * the view renders it directly.
 *
 * No new business logic. No LLM calls. No external API.
 * No automation. The advisor only generates advice.
 */
export interface AdvisorData {
  advisor: AdvisorResponse;
}

export type AdvisorDataState =
  | { status: "loading" }
  | { status: "ready"; data: AdvisorData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseAdvisorDataResult {
  state: AdvisorDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hook
// --------------------------------------------------------------------------- //

export function useAdvisorQuery() {
  return useQuery<AdvisorResponse>({
    queryKey: queryKeys.advisor(),
    queryFn: () => advisorService.get(),
  });
}

// --------------------------------------------------------------------------- //
// Bundled hook
// --------------------------------------------------------------------------- //

export function useAdvisorData(): UseAdvisorDataResult {
  const advisor = useAdvisorQuery();
  const queryClient = useQueryClient();

  const isFetching = advisor.isFetching;

  const noBusinessError = useMemo(() => {
    if (
      advisor.error instanceof ApiError &&
      advisor.error.status === 404
    ) {
      return advisor.error;
    }
    return null;
  }, [advisor.error]);

  const firstHardError = useMemo(() => {
    if (!advisor.error) return null;
    if (
      advisor.error instanceof ApiError &&
      advisor.error.status === 404
    ) {
      return null;
    }
    return advisor.error;
  }, [advisor.error]);

  const firstHardLoading = advisor.isLoading;

  const state: AdvisorDataState = useMemo(() => {
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
          : "Could not load the advisor.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (!advisor.data) {
      return { status: "loading" };
    }
    return {
      status: "ready",
      data: { advisor: advisor.data },
    };
  }, [noBusinessError, firstHardError, firstHardLoading, advisor.data]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.advisor() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}
