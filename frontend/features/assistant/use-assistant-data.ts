/**
 * TanStack Query bundle + chat state for the AI Business
 * Assistant UI (Sprint 7 Part 1).
 *
 * The hook loads the five upstream payloads in parallel
 * and surfaces a discriminated union the view can render
 * directly, mirroring the state machine used by every
 * other analytics surface in the app:
 *
 *   loading -> ready | no-business | error
 *
 * `Decision` is treated as optional (its 404 is non-fatal)
 * because the AI Decision engine can legitimately have no
 * output yet. The builder handles the missing-decision case
 * internally.
 *
 * The hook also owns the local chat-history state (the
 * conversation thread on the left) and exposes the
 * `submit` / `clear` actions. History is component-local —
 * there is no persistence, no LLM, no memory: per the
 * spec, "Memory" is explicitly out of scope.
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import {
  decisionService,
  recommendationsService,
  roadmapService,
  rulesService,
  twinService,
} from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  AIDecisionResponse,
  RulesResponse,
} from "@/types/dashboard";
import type {
  RecommendationsResponse,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import { buildAssistantResponse, type AssistantBundle } from "./builder";
import { classifyQuery } from "./classify-query";
import {
  SUGGESTED_QUESTIONS,
  findSuggestedQuestionByKind,
} from "./suggested-questions";
import type {
  AssistantContext,
  AssistantResponse,
  ChatMessage,
  Conversation,
  QueryKind,
  SuggestedQuestion,
} from "./types";

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks
// --------------------------------------------------------------------------- //

function useTwinQuery() {
  return useQuery<TwinResponse>({
    queryKey: queryKeys.twin(),
    queryFn: () => twinService.compute(),
  });
}

function useRecommendationsQuery() {
  return useQuery<RecommendationsResponse>({
    queryKey: queryKeys.recommendations(),
    queryFn: () => recommendationsService.compute(),
  });
}

function useRoadmapQuery() {
  return useQuery<RoadmapResponse>({
    queryKey: queryKeys.roadmap(),
    queryFn: () => roadmapService.compute(),
  });
}

function useRulesQuery() {
  return useQuery<RulesResponse>({
    queryKey: queryKeys.rules(),
    queryFn: () => rulesService.compute(),
  });
}

function useDecisionQuery() {
  return useQuery<AIDecisionResponse>({
    queryKey: queryKeys.decision(),
    queryFn: () => decisionService.compute(),
    // AI Decision can legitimately 404 — tolerate it, surface
    // anything else. Mirrors useInsightsData.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// --------------------------------------------------------------------------- //
// State machine
// --------------------------------------------------------------------------- //

export type AssistantDataState =
  | { status: "loading" }
  | { status: "ready"; bundle: AssistantBundle; context: AssistantContext }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseAssistantDataResult {
  state: AssistantDataState;
  /** True while any of the five underlying queries is fetching. */
  isFetching: boolean;
  /** Force a re-fetch of every payload the assistant depends on. */
  refresh: () => void;

  /** Suggested-question chips rendered above the prompt box. */
  suggestedQuestions: readonly SuggestedQuestion[];

  /** The local conversation. */
  conversation: Conversation;
  /** Submit a free-text prompt and append the assistant's reply. */
  submit: (prompt: string) => void;
  /** Submit one of the suggested-question chips. */
  submitSuggested: (id: string) => void;
  /** Clear the conversation history. */
  clear: () => void;
  /** True while the assistant is composing a reply. */
  isThinking: boolean;
}

// --------------------------------------------------------------------------- //
// Context builder — pure, derived from the bundle
// --------------------------------------------------------------------------- //

import type { RecommendationPhase } from "@/types/analytics";

const PHASE_ORDER: readonly RecommendationPhase[] = [
  "Immediate",
  "Short-Term",
  "Medium-Term",
  "Long-Term",
];

function buildContext(bundle: AssistantBundle): AssistantContext {
  const { twin, recommendations, roadmap, rules } = bundle;
  const total = roadmap.items.length;
  const avgCompletion =
    total === 0
      ? 0
      : Math.round(
          roadmap.items.reduce(
            (acc, it) => acc + (it.completion_percentage ?? 0),
            0,
          ) / total,
        );
  const phasesPresent = new Set(roadmap.items.map((it) => it.phase));
  let currentPhase = "—";
  for (const p of PHASE_ORDER) {
    if (phasesPresent.has(p)) {
      currentPhase = p;
      break;
    }
  }
  const incomplete =
    recommendations.recommendations.length === 0 ||
    roadmap.items.length === 0 ||
    rules.summary.total_firings === 0;

  return {
    score: {
      value: twin.current_health.overall_business_score,
      band:
        twin.current_health.overall_business_score >= 75
          ? "Leading"
          : twin.current_health.overall_business_score >= 50
          ? "Established"
          : twin.current_health.overall_business_score >= 25
          ? "Developing"
          : "Foundation",
    },
    dna: {
      archetype: twin.current_health.business_dna_archetype,
      match: twin.current_health.business_dna_match,
    },
    recommendations: {
      total: recommendations.recommendations.length,
      critical: recommendations.summary.critical_count,
      high: recommendations.summary.high_count,
      medium: recommendations.summary.medium_count,
      low: recommendations.summary.low_count,
    },
    roadmap: {
      totalItems: total,
      avgCompletion,
      currentPhase,
      totalDuration: roadmap.summary.total_estimated_duration,
    },
    incomplete,
  };
}

// --------------------------------------------------------------------------- //
// Local-id + timestamp helpers
// --------------------------------------------------------------------------- //

function makeId(prefix: string): string {
  // Crypto.randomUUID is available in modern browsers + Node; this
  // is the only randomness in the assistant, and it is purely for
  // React keys, not for response content.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// --------------------------------------------------------------------------- //
// Bundled hook
// --------------------------------------------------------------------------- //

export function useAssistantData(): UseAssistantDataResult {
  const twin = useTwinQuery();
  const recommendations = useRecommendationsQuery();
  const roadmap = useRoadmapQuery();
  const rules = useRulesQuery();
  const decision = useDecisionQuery();
  const queryClient = useQueryClient();

  const isFetching =
    twin.isFetching ||
    recommendations.isFetching ||
    roadmap.isFetching ||
    rules.isFetching ||
    decision.isFetching;

  const noBusinessError = useMemo(() => {
    const candidates = [twin, recommendations, roadmap, rules];
    for (const q of candidates) {
      if (q.error instanceof ApiError && q.error.status === 404) {
        return q.error;
      }
    }
    return null;
  }, [twin.error, recommendations.error, roadmap.error, rules.error]);

  const firstHardError = useMemo(() => {
    for (const q of [twin, recommendations, roadmap, rules]) {
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
    recommendations.error,
    roadmap.error,
    rules.error,
    decision.error,
  ]);

  const firstHardLoading =
    twin.isLoading ||
    recommendations.isLoading ||
    roadmap.isLoading ||
    rules.isLoading;

  // Chat history — component-local state, intentionally not
  // persisted (per the spec's "No memory" out-of-scope item).
  const [conversation, setConversation] = useState<Conversation>(() => ({
    id: "default",
    messages: [],
    lastMessageAt: null,
  }));
  const [isThinking, setIsThinking] = useState(false);

  const state: AssistantDataState = useMemo(() => {
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
          : "Could not load assistant data.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (
      !twin.data ||
      !recommendations.data ||
      !roadmap.data ||
      !rules.data
    ) {
      return { status: "loading" };
    }
    const bundle: AssistantBundle = {
      twin: twin.data,
      recommendations: recommendations.data,
      roadmap: roadmap.data,
      rules: rules.data,
      decision: decision.data ?? null,
    };
    return {
      status: "ready",
      bundle,
      context: buildContext(bundle),
    };
  }, [
    noBusinessError,
    firstHardError,
    firstHardLoading,
    twin.data,
    recommendations.data,
    roadmap.data,
    rules.data,
    decision.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.twin() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.roadmap() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.rules() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.decision() });
  }, [queryClient]);

  // Build the assistant reply for a given prompt. The response
  // is computed synchronously because every input is local —
  // there is no network call inside `buildAssistantResponse`.
  const buildReply = useCallback(
    (bundle: AssistantBundle, kind: QueryKind): AssistantResponse =>
      buildAssistantResponse(bundle, kind),
    [],
  );

  const submit = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (trimmed.length === 0) return;
      if (state.status !== "ready") return;
      const kind = classifyQuery(trimmed);
      const userMsg: ChatMessage = {
        id: makeId("u"),
        role: "user",
        content: trimmed,
        createdAt: nowIso(),
        kind,
      };
      // Optimistic append: show the user message immediately.
      // The reply is built synchronously from local data, so
      // we add it on the next microtask to keep the user
      // message visually first.
      setIsThinking(true);
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        lastMessageAt: userMsg.createdAt,
      }));
      // Use queueMicrotask so the user message renders first.
      queueMicrotask(() => {
        const reply = buildReply(state.bundle, kind);
        const assistantMsg: ChatMessage = {
          id: makeId("a"),
          role: "assistant",
          content: reply.body,
          createdAt: nowIso(),
          sources: reply.sources,
          kind: reply.kind,
        };
        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMsg],
          lastMessageAt: assistantMsg.createdAt,
        }));
        setIsThinking(false);
      });
    },
    [buildReply, state],
  );

  const submitSuggested = useCallback(
    (id: string) => {
      const chip = SUGGESTED_QUESTIONS.find((q) => q.id === id);
      if (!chip) return;
      submit(chip.text);
    },
    [submit],
  );

  const clear = useCallback(() => {
    setConversation({
      id: "default",
      messages: [],
      lastMessageAt: null,
    });
    setIsThinking(false);
  }, []);

  return {
    state,
    isFetching,
    refresh,
    suggestedQuestions: SUGGESTED_QUESTIONS,
    conversation,
    submit,
    submitSuggested,
    clear,
    isThinking,
  };
}

// Re-exports for callers that want a single import surface.
export { findSuggestedQuestionByKind };
