"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import { advisorService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type { AdvisorAggregateResponse, AdvisorResponse } from "@/types/advisor";

export interface AdvisorData {
  advisor: AdvisorResponse;
}

export interface AdvisorAggregateData {
  aggregate: AdvisorAggregateResponse;
}

export type AdvisorDataState =
  | { status: "loading" }
  | { status: "ready"; data: AdvisorData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export type AdvisorAggregateDataState =
  | { status: "loading" }
  | { status: "ready"; data: AdvisorAggregateData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseAdvisorDataResult {
  state: AdvisorDataState;
  refresh: () => void;
  isFetching: boolean;
}

export interface UseAdvisorAggregateDataResult {
  state: AdvisorAggregateDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks
// --------------------------------------------------------------------------- //

export function useAdvisorQuery() {
  return useQuery<AdvisorResponse>({
    queryKey: queryKeys.advisor(),
    queryFn: () => advisorService.get(),
  });
}

export function useAdvisorAggregateQuery() {
  return useQuery<AdvisorAggregateResponse>({
    queryKey: queryKeys.advisorAggregate(),
    queryFn: () => advisorService.getAggregate(),
  });
}

// --------------------------------------------------------------------------- //
// Bundled hooks
// --------------------------------------------------------------------------- //

export function useAdvisorAggregateData(): UseAdvisorAggregateDataResult {
  const query = useAdvisorAggregateQuery();
  const queryClient = useQueryClient();

  const isFetching = query.isFetching;

  const noBusinessError = useMemo(() => {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return query.error;
    }
    return null;
  }, [query.error]);

  const firstHardError = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof ApiError && query.error.status === 404) {
      return null;
    }
    return query.error;
  }, [query.error]);

  const state: AdvisorAggregateDataState = useMemo(() => {
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
          : "Could not load aggregate advisor.";
      return { status: "error", detail: message };
    }
    if (query.isLoading || !query.data) {
      return { status: "loading" };
    }
    return {
      status: "ready",
      data: { aggregate: query.data },
    };
  }, [noBusinessError, firstHardError, query.isLoading, query.data]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.advisorAggregate() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}

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
