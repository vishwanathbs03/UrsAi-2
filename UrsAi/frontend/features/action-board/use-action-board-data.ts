"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";
import { decisionService, rulesService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  AIDecisionInsight,
  AIDecisionResponse,
  RuleFiring,
  RulePriority,
  RulesResponse,
} from "@/types/dashboard";

/**
 * Categories used to organise cards in the UI. We translate
 * the rule engine's snake_case `RuleCategory` values into a
 * human-readable label; the original key is preserved on the
 * card so consumers can still group / filter by it.
 */
export const ACTION_CATEGORY_LABELS: Record<string, string> = {
  immediate_actions: "Immediate Actions",
  high_priority: "High Priority",
  medium_priority: "Medium Priority",
  long_term: "Long Term",
  risk_alerts: "Risk Alerts",
  compliance_actions: "Compliance",
  export_readiness_actions: "Export Readiness",
  digital_transformation_actions: "Digital Transformation",
};

export const PRIORITY_LABELS: Record<RulePriority, string> = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
};

export type Difficulty = "Easy" | "Moderate" | "Hard" | "Expert";

/**
 * The shape of one Kanban action card. Every field the spec
 * asked for is present; the few that the backend does not
 * produce (ROI, expected score improvement, estimated time,
 * difficulty, knowledge count) are derived deterministically
 * from the rule firing + any matching AI insight, with the
 * derivation rule documented inline.
 */
export interface ActionCardItem {
  id: string;
  title: string;
  priority: RulePriority;
  categoryKey: string;
  category: string;
  estimatedBusinessImpact: number;
  estimatedRoi: number;
  expectedScoreImprovement: number;
  estimatedTime: string;
  difficulty: Difficulty;
  supportingKnowledgeCount: number;
  aiExplanation: string;
  aiConfidence: number | null;
  sourceKeys: string[];
  hasAiBacking: boolean;
  /** Ids of related knowledge articles from the matching AI
   *  insight, if any. Empty array otherwise. Used by the
   *  slide-over "Related knowledge" section. */
  relatedArticleIds: string[];
}

export interface ActionBoardData {
  rules: RulesResponse;
  decision: AIDecisionResponse | null;
  cards: ActionCardItem[];
}

export type ActionBoardDataState =
  | { status: "loading" }
  | { status: "ready"; data: ActionBoardData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseActionBoardDataResult {
  state: ActionBoardDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks.
// --------------------------------------------------------------------------- //

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
    // AI Decision can legitimately 404 in the current
    // milestone. Tolerate that; surface anything else.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// --------------------------------------------------------------------------- //
// Bundled action board hook.
// --------------------------------------------------------------------------- //

/**
 * Loads rules + (optionally) the AI decision payload and
 * joins them into the action-card shape. Mirrors the
 * discriminated-union pattern of `useDashboardData` (loading
 * / ready / error / no-business) so the view can render the
 * same way.
 *
 * Sprint 4 update: the underlying fetches now go through
 * TanStack Query. Public state-machine API preserved.
 */
export function useActionBoardData(): UseActionBoardDataResult {
  const rules = useRulesQuery();
  const decision = useDecisionQuery();
  const queryClient = useQueryClient();

  const isFetching = rules.isFetching || decision.isFetching;

  const noBusinessError = useMemo(() => {
    if (rules.error instanceof ApiError && rules.error.status === 404) {
      return rules.error;
    }
    return null;
  }, [rules.error]);

  const firstHardError = useMemo(() => {
    if (rules.error) return rules.error;
    if (
      decision.error &&
      !(decision.error instanceof ApiError && decision.error.status === 404)
    ) {
      return decision.error;
    }
    return null;
  }, [rules.error, decision.error]);

  const firstHardLoading = rules.isLoading;

  const state: ActionBoardDataState = useMemo(() => {
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
          : "Could not load the action board.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (!rules.data) {
      // Defensive: rules.data must be present if we're past
      // the loading + error states. If it's somehow not,
      // fall through to the loading branch on the next
      // render rather than throwing.
      return { status: "loading" };
    }
    const insightMap = decision.data
      ? indexInsightsByRule(decision.data.decision.insights ?? [])
      : {};
    const firings = flattenFirings(rules.data);
    const cards = firings.map((f, i) => buildCard(f, i, insightMap));
    return {
      status: "ready",
      data: { rules: rules.data, decision: decision.data ?? null, cards },
    };
  }, [noBusinessError, firstHardError, firstHardLoading, rules.data, decision.data]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionBoardAll() });
  }, [queryClient]);

  return { state, refresh, isFetching };
}

// --------------------------------------------------------------------------- //
// Derivation helpers (unchanged from Sprint 4 Part 2)
// --------------------------------------------------------------------------- //

function deriveEstimatedRoi(priority: RulePriority, impact: number): number {
  const weight: Record<RulePriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  const raw = weight[priority] * 12 + impact * 0.4;
  return Math.round(clamp(raw, 0, 100));
}

function deriveExpectedScoreImprovement(
  priority: RulePriority,
  impact: number,
): number {
  const weight: Record<RulePriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  const delta = impact * 0.6 + weight[priority] * 1.5;
  return Math.round(clamp(delta, 0, 25) * 10) / 10;
}

function deriveEstimatedTime(priority: RulePriority, impact: number): string {
  const priorityNudge: Record<RulePriority, number> = {
    Critical: -2,
    High: -1,
    Medium: 0,
    Low: 1,
  };
  const base = impact >= 70 ? 12 : impact >= 50 ? 8 : impact >= 30 ? 4 : 2;
  const weeks = Math.max(1, base + priorityNudge[priority]);
  if (weeks === 1) return "~1 week";
  if (weeks < 4) return `~${weeks} weeks`;
  const months = Math.round(weeks / 4);
  if (months === 1) return "~1 month";
  return `~${months} months`;
}

function deriveDifficulty(
  priority: RulePriority,
  impact: number,
): Difficulty {
  const weight: Record<RulePriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  const score = weight[priority] * 15 - impact * 0.4 + 50;
  if (score >= 80) return "Easy";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Hard";
  return "Expert";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function indexInsightsByRule(
  insights: AIDecisionInsight[],
): Record<string, AIDecisionInsight> {
  const map: Record<string, AIDecisionInsight> = {};
  for (const insight of insights) {
    for (const ruleId of insight.supporting_rule_ids) {
      if (!map[ruleId]) {
        map[ruleId] = insight;
      }
    }
  }
  return map;
}

function buildCard(
  firing: RuleFiring,
  _index: number,
  insightMap: Record<string, AIDecisionInsight>,
): ActionCardItem {
  const insight = insightMap[firing.id] ?? null;
  const supportingKnowledgeCount =
    insight?.supporting_article_ids.length ?? firing.source_keys.length;
  return {
    id: firing.id,
    title: insight?.title ?? firing.title,
    priority: firing.priority,
    categoryKey: firing.category,
    category: ACTION_CATEGORY_LABELS[firing.category] ?? firing.category,
    estimatedBusinessImpact: firing.estimated_impact,
    estimatedRoi: deriveEstimatedRoi(firing.priority, firing.estimated_impact),
    expectedScoreImprovement: deriveExpectedScoreImprovement(
      firing.priority,
      firing.estimated_impact,
    ),
    estimatedTime: deriveEstimatedTime(firing.priority, firing.estimated_impact),
    difficulty: deriveDifficulty(firing.priority, firing.estimated_impact),
    supportingKnowledgeCount,
    aiExplanation: insight?.explanation ?? firing.reason,
    aiConfidence: insight ? insight.confidence : null,
    sourceKeys: firing.source_keys,
    hasAiBacking: insight !== null,
    relatedArticleIds: insight?.supporting_article_ids ?? [],
  };
}

function flattenFirings(rules: RulesResponse): RuleFiring[] {
  const out: RuleFiring[] = [];
  for (const block of Object.values(rules.categories)) {
    if (!block || !Array.isArray(block.firings)) continue;
    for (const firing of block.firings) {
      out.push(firing);
    }
  }
  return out;
}
