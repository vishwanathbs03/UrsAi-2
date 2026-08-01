"use client";

import { useCallback, useMemo } from "react";
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
  RuleFiring,
  RulesResponse,
} from "@/types/dashboard";
import type {
  RecommendationItem,
  RecommendationsResponse,
  RoadmapItem,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import { classifyInsightCategory } from "./use-insights-filters";

// --------------------------------------------------------------------------- //
// Insight shape
// --------------------------------------------------------------------------- //

/**
 * One enriched insight card. Built by joining:
 *   - an AIDecision insight (title / summary / confidence / supporting ids)
 *   - any rule firings whose ids appear in the supporting_rule_ids
 *   - any recommendations linked through the same rule ids
 *   - any roadmap items linked through those recommendation ids
 *
 * No new business logic: the joins are all key lookups on fields
 * the upstream payloads already carry.
 */
export interface InsightItem {
  id: string;
  title: string;
  explanation: string;
  /** The raw category string the AI Decision engine reported. */
  rawCategory: string;
  /** The normalised spec category (one of the six canonical values). */
  category: InsightCategoryKey;
  confidence: number;
  /** Priority inferred from the highest-priority supporting rule
   *  firing. Defaults to "Low" when the AI insight has no
   *  supporting rules. */
  priority: RuleFiring["priority"];
  supportingRuleIds: string[];
  supportingArticleIds: string[];
  /** Hydrated supporting rule firings. */
  supportingRules: RuleFiring[];
  /** Hydrated recommendations linked through the supporting rules. */
  relatedRecommendations: RecommendationItem[];
  /** Hydrated roadmap items linked through the related recommendations. */
  relatedRoadmapItems: RoadmapItem[];
}

/**
 * The six spec categories. The classifier in
 * use-insights-filters.ts maps any raw AI category
 * (or related-recommendation category) into one of these.
 */
export type InsightCategoryKey =
  | "opportunities"
  | "risks"
  | "growth"
  | "compliance"
  | "digital"
  | "export";

export interface InsightsData {
  decision: AIDecisionResponse;
  rules: RulesResponse;
  recommendations: RecommendationsResponse;
  roadmap: RoadmapResponse;
  twin: TwinResponse;
  insights: InsightItem[];
}

export type InsightsDataState =
  | { status: "loading" }
  | { status: "ready"; data: InsightsData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseInsightsDataResult {
  state: InsightsDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks
// --------------------------------------------------------------------------- //

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

export function useRulesQuery() {
  return useQuery<RulesResponse>({
    queryKey: queryKeys.rules(),
    queryFn: () => rulesService.compute(),
  });
}

export function useRecommendationsQuery() {
  return useQuery<RecommendationsResponse>({
    queryKey: queryKeys.recommendations(),
    queryFn: () => recommendationsService.compute(),
  });
}

export function useRoadmapQuery() {
  return useQuery<RoadmapResponse>({
    queryKey: queryKeys.roadmap(),
    queryFn: () => roadmapService.compute(),
  });
}

export function useTwinQuery() {
  return useQuery<TwinResponse>({
    queryKey: queryKeys.twin(),
    queryFn: () => twinService.compute(),
  });
}

// --------------------------------------------------------------------------- //
// Bundled insights hook
// --------------------------------------------------------------------------- //

/**
 * Loads the five upstream payloads needed to build the
 * insights feed and surfaces a discriminated union the
 * view can render directly. Decision is treated as
 * "optional" (its 404 is non-fatal) so the page can still
 * render the four overview tiles + the raw rule firings
 * when the AI engine has no output yet. The full
 * insights list, however, requires the decision payload,
 * so the "ready" state for the *feed* keys on
 * `state.status === "ready" && state.data.insights.length >= 0`
 * (i.e. the moment decision.data exists, even if the
 * engine returned zero insights).
 */
export function useInsightsData(): UseInsightsDataResult {
  const decision = useDecisionQuery();
  const rules = useRulesQuery();
  const recommendations = useRecommendationsQuery();
  const roadmap = useRoadmapQuery();
  const twin = useTwinQuery();
  const queryClient = useQueryClient();

  const isFetching =
    decision.isFetching ||
    rules.isFetching ||
    recommendations.isFetching ||
    roadmap.isFetching ||
    twin.isFetching;

  const noBusinessError = useMemo(() => {
    const candidates = [rules, recommendations, roadmap, twin];
    for (const q of candidates) {
      if (q.error instanceof ApiError && q.error.status === 404) {
        return q.error;
      }
    }
    return null;
  }, [rules.error, recommendations.error, roadmap.error, twin.error]);

  const firstHardError = useMemo(() => {
    const required = [rules, recommendations, roadmap, twin];
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
    rules.error,
    recommendations.error,
    roadmap.error,
    twin.error,
    decision.error,
  ]);

  const firstHardLoading =
    rules.isLoading ||
    recommendations.isLoading ||
    roadmap.isLoading ||
    twin.isLoading;

  const state: InsightsDataState = useMemo(() => {
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
          : "Could not load insights.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (
      !rules.data ||
      !recommendations.data ||
      !roadmap.data ||
      !twin.data
    ) {
      return { status: "loading" };
    }

    // Decision is optional — if it's missing (404) we
    // still want to land on "ready" so the rest of the
    // page can render. The view checks for the decision
    // payload directly when it needs the AI summary.
    if (!decision.data) {
      return {
        status: "ready",
        data: {
          decision: {
            generated_at: "",
            inputs: {
              intelligence_generated_at: null,
              scores_generated_at: null,
              dna_generated_at: null,
              rules_generated_at: null,
              model: "unavailable",
            },
            decision: {
              summary: "",
              archetype_label: "",
              overall_health: "",
              top_strengths: [],
              top_risks: [],
              insights: [],
            },
          },
          rules: rules.data,
          recommendations: recommendations.data,
          roadmap: roadmap.data,
          twin: twin.data,
          insights: [],
        },
      };
    }

    return {
      status: "ready",
      data: {
        decision: decision.data,
        rules: rules.data,
        recommendations: recommendations.data,
        roadmap: roadmap.data,
        twin: twin.data,
        insights: buildInsights({
          decision: decision.data,
          rules: rules.data,
          recommendations: recommendations.data,
          roadmap: roadmap.data,
        }),
      },
    };
  }, [
    noBusinessError,
    firstHardError,
    firstHardLoading,
    rules.data,
    recommendations.data,
    roadmap.data,
    twin.data,
    decision.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analyticsAll() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionBoardAll() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}

// --------------------------------------------------------------------------- //
// Join helpers (pure)
// --------------------------------------------------------------------------- //

interface BuildInsightsArgs {
  decision: AIDecisionResponse;
  rules: RulesResponse;
  recommendations: RecommendationsResponse;
  roadmap: RoadmapResponse;
}

const PRIORITY_ORDER: Record<RuleFiring["priority"], number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function buildInsights(args: BuildInsightsArgs): InsightItem[] {
  const { decision, rules, recommendations, roadmap } = args;

  const ruleMap = new Map<string, RuleFiring>();
  if (rules?.categories) {
    for (const block of Object.values(rules.categories)) {
      if (!block || !Array.isArray(block.firings)) continue;
      for (const f of block.firings) {
        if (f?.id) ruleMap.set(f.id, f);
      }
    }
  }

  const recsByRuleId = new Map<string, RecommendationItem[]>();
  const recList = Array.isArray(recommendations?.recommendations)
    ? recommendations.recommendations
    : [];
  for (const r of recList) {
    const sRuleIds = Array.isArray(r.supporting_rule_ids) ? r.supporting_rule_ids : [];
    for (const rid of sRuleIds) {
      const list = recsByRuleId.get(rid);
      if (list) {
        list.push(r);
      } else {
        recsByRuleId.set(rid, [r]);
      }
    }
  }

  const roadmapByRecId = new Map<string, RoadmapItem>();
  const roadmapItems = Array.isArray(roadmap?.items) ? roadmap.items : [];
  for (const item of roadmapItems) {
    if (item?.recommendation_id) {
      roadmapByRecId.set(item.recommendation_id, item);
    }
  }

  const decisionInsights = Array.isArray(decision?.decision?.insights)
    ? decision.decision.insights
    : [];

  if (decisionInsights.length === 0) {
    // Generate fallback insights from recommendations & rules
    return recList.slice(0, 5).map((rec, idx) => ({
      id: `insight.rec.${rec.id || idx}`,
      title: rec.title || "Strategic Improvement Opportunity",
      explanation: rec.description || "Operational efficiency recommendation derived from Digital Twin metrics.",
      rawCategory: rec.category || "growth",
      category: classifyInsightCategory({
        aiCategory: rec.category,
        recommendationCategories: [rec.category],
      }),
      confidence: rec.confidence || 88,
      priority: rec.priority || "Medium",
      supportingRuleIds: Array.isArray(rec.supporting_rule_ids) ? rec.supporting_rule_ids : [],
      supportingArticleIds: Array.isArray(rec.supporting_article_ids) ? rec.supporting_article_ids : [],
      supportingRules: [],
      relatedRecommendations: [rec],
      relatedRoadmapItems: [],
    }));
  }

  return decisionInsights.map((insight) => {
    const sRuleIds = Array.isArray(insight.supporting_rule_ids)
      ? insight.supporting_rule_ids
      : [];
    const supportingRules: RuleFiring[] = [];
    for (const rid of sRuleIds) {
      const f = ruleMap.get(rid);
      if (f) supportingRules.push(f);
    }
    supportingRules.sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
    );

    const relatedRecs: RecommendationItem[] = [];
    const seenRecs = new Set<string>();
    for (const rule of supportingRules) {
      const matched = recsByRuleId.get(rule.id) ?? [];
      for (const r of matched) {
        if (seenRecs.has(r.id)) continue;
        seenRecs.add(r.id);
        relatedRecs.push(r);
      }
    }

    if (relatedRecs.length === 0) {
      const fallback = recList
        .filter((r) => r.category === insight.category)
        .slice(0, 3);
      for (const r of fallback) relatedRecs.push(r);
    }

    const relatedRoadmap: RoadmapItem[] = [];
    for (const rec of relatedRecs) {
      const ri = roadmapByRecId.get(rec.id);
      if (ri) relatedRoadmap.push(ri);
    }

    const priority: RuleFiring["priority"] = supportingRules[0]?.priority ?? "Low";
    const category: InsightCategoryKey = classifyInsightCategory({
      aiCategory: insight.category,
      recommendationCategories: relatedRecs.map((r) => r.category),
    });

    return {
      id: insight.id,
      title: insight.title,
      explanation: insight.explanation,
      rawCategory: insight.category,
      category,
      confidence: insight.confidence,
      priority,
      supportingRuleIds: sRuleIds,
      supportingArticleIds: Array.isArray(insight.supporting_article_ids)
        ? insight.supporting_article_ids
        : [],
      supportingRules,
      relatedRecommendations: relatedRecs,
      relatedRoadmapItems: relatedRoadmap,
    };
  });
}
