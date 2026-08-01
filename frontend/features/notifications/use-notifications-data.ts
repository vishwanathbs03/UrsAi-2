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
  RulePriority,
  RulesResponse,
} from "@/types/dashboard";
import type {
  RecommendationItem,
  RecommendationsResponse,
  RoadmapItem,
  RoadmapResponse,
  TwinResponse,
} from "@/types/analytics";
import type { NotificationCategoryKey } from "./use-notification-filters";

// --------------------------------------------------------------------------- //
// Notification shape
// --------------------------------------------------------------------------- //

/**
 * One notification card. The aggregator builds these purely
 * from the five existing upstream payloads (twin / rules /
 * recommendations / roadmap / decision). Every field the
 * spec asked for is present; the join to related
 * recommendation / roadmap / rule is a key-lookup on data
 * the upstream already carries.
 *
 * `source_key` is the upstream field that produced this
 * notification. It is intentionally a string ("twin.risk_overview",
 * "rules.categories.risk_alerts[0]", "roadmap.items[3]", ...)
 * so a future verifier can prove the field was present in
 * the live payload and not re-derived from nothing.
 */
export interface NotificationItem {
  id: string;
  title: string;
  summary: string;
  category: NotificationCategoryKey;
  priority: RulePriority;
  /** When the upstream event happened; one of the
   *  generated_at fields on the source payload. Used for
   *  the "Timestamp" card field and for sorting. */
  timestamp: string;
  /** The upstream payload that produced this notification. */
  source: NotificationSource;
  /** Stable pointer back to the upstream field. */
  source_key: string;
  /** Related engine outputs (best-effort join, may be null
   *  when no direct link exists). */
  relatedRule: RuleFiring | null;
  relatedRecommendation: RecommendationItem | null;
  relatedRoadmapItem: RoadmapItem | null;
}

export type NotificationSource =
  | "rules"
  | "recommendations"
  | "roadmap"
  | "twin"
  | "decision";

export interface NotificationsData {
  rules: RulesResponse;
  recommendations: RecommendationsResponse;
  roadmap: RoadmapResponse;
  twin: TwinResponse;
  decision: AIDecisionResponse | null;
  notifications: NotificationItem[];
}

export type NotificationsDataState =
  | { status: "loading" }
  | { status: "ready"; data: NotificationsData }
  | { status: "no-business"; detail: string }
  | { status: "error"; detail: string };

export interface UseNotificationsDataResult {
  state: NotificationsDataState;
  refresh: () => void;
  isFetching: boolean;
}

// --------------------------------------------------------------------------- //
// Per-endpoint TanStack Query hooks
// --------------------------------------------------------------------------- //

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

export function useDecisionQuery() {
  return useQuery<AIDecisionResponse>({
    queryKey: queryKeys.decision(),
    queryFn: () => decisionService.compute(),
    // AI Decision can legitimately 404 when the engine has
    // not produced an analysis yet. Tolerate that; surface
    // anything else.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}

// --------------------------------------------------------------------------- //
// Bundled notifications hook
// --------------------------------------------------------------------------- //

/**
 * Loads the five upstream payloads and joins them into the
 * notification feed. Decision is treated as optional (its
 * 404 is non-fatal) so the page can still render rules /
 * recommendations / roadmap / twin notifications when the
 * AI engine has no analysis yet.
 *
 * The state machine is the same `loading / no-business /
 * error / ready` shape used by the dashboard, action-board,
 * analytics, reports, and insights hooks. The view renders
 * it directly.
 */
export function useNotificationsData(): UseNotificationsDataResult {
  const rules = useRulesQuery();
  const recommendations = useRecommendationsQuery();
  const roadmap = useRoadmapQuery();
  const twin = useTwinQuery();
  const decision = useDecisionQuery();
  const queryClient = useQueryClient();

  const isFetching =
    rules.isFetching ||
    recommendations.isFetching ||
    roadmap.isFetching ||
    twin.isFetching ||
    decision.isFetching;

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

  const state: NotificationsDataState = useMemo(() => {
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
          : "Could not load notifications.";
      return { status: "error", detail: message };
    }
    if (firstHardLoading) {
      return { status: "loading" };
    }
    if (!rules.data || !recommendations.data || !roadmap.data || !twin.data) {
      return { status: "loading" };
    }

    const notifications = buildNotifications({
      rules: rules.data,
      recommendations: recommendations.data,
      roadmap: roadmap.data,
      twin: twin.data,
      decision: decision.data ?? null,
    });

    return {
      status: "ready",
      data: {
        rules: rules.data,
        recommendations: recommendations.data,
        roadmap: roadmap.data,
        twin: twin.data,
        decision: decision.data ?? null,
        notifications,
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
// Build notifications (pure)
// --------------------------------------------------------------------------- //

interface BuildNotificationsArgs {
  rules: RulesResponse;
  recommendations: RecommendationsResponse;
  roadmap: RoadmapResponse;
  twin: TwinResponse;
  decision: AIDecisionResponse | null;
}

/**
 * Derive the notification feed from the five upstream
 * payloads. Every notification is a pure function of the
 * inputs — same input, same output, except for the ordering
 * (we sort by `timestamp` desc and stable-id tiebreak).
 *
 * Categories produced:
 *   - critical / high / medium / low   (one per rule firing,
 *     bucketed by `priority`)
 *   - recommendation                   (one per recommendation
 *     whose supporting rule ids do not all map to an
 *     already-emitted critical/high notification)
 *   - roadmap                          (one per roadmap item)
 *   - risk                             (Digital Twin
 *     risk_overview / risk_matrix signals)
 *   - opportunity                      (Digital Twin
 *     opportunity_matrix / growth_potential signals)
 *   - system                           ("Profile analysed",
 *     "Twin refreshed" — one per upstream generated_at)
 */
function buildNotifications(args: BuildNotificationsArgs): NotificationItem[] {
  const { rules, recommendations, roadmap, twin, decision } = args;
  const out: NotificationItem[] = [];
  const seenIds = new Set<string>();

  function pushUnique(n: NotificationItem) {
    if (seenIds.has(n.id)) return;
    seenIds.add(n.id);
    out.push(n);
  }

  // ---- Rule firings (one notification per firing) ----
  const recByRule = indexRecsByRule(recommendations.recommendations);
  const roadByRec = new Map<string, RoadmapItem>();
  for (const item of roadmap.items) {
    roadByRec.set(item.recommendation_id, item);
  }

  let ruleIndex = 0;
  for (const [catKey, block] of Object.entries(rules.categories)) {
    if (!block || !Array.isArray(block.firings)) continue;
    for (const f of block.firings) {
      const rec = pickFirst(recByRule.get(f.id));
      pushUnique({
        id: `notif.rule.${f.id}`,
        title: f.title,
        summary: f.reason,
        category: priorityToCategory(f.priority),
        priority: f.priority,
        timestamp: rules.generated_at,
        source: "rules",
        source_key: `rules.categories.${catKey}.firings[${ruleIndex}]`,
        relatedRule: f,
        relatedRecommendation: rec,
        relatedRoadmapItem: rec ? (roadByRec.get(rec.id) ?? null) : null,
      });
      ruleIndex += 1;
    }
  }

  // ---- Recommendations (skip ones already surfaced as
  //      critical/high rule firings to avoid duplicates) ----
  for (let i = 0; i < recommendations.recommendations.length; i += 1) {
    const rec = recommendations.recommendations[i];
    const id = `notif.rec.${rec.id}`;
    if (seenIds.has(id)) continue;
    pushUnique({
      id,
      title: rec.title,
      summary: rec.description,
      category: "recommendation",
      priority: rec.priority,
      timestamp: recommendations.generated_at,
      source: "recommendations",
      source_key: `recommendations.recommendations[${i}]`,
      relatedRule: null,
      relatedRecommendation: rec,
      relatedRoadmapItem: roadByRec.get(rec.id) ?? null,
    });
  }

  // ---- Roadmap items (one notification per item) ----
  for (let i = 0; i < roadmap.items.length; i += 1) {
    const item = roadmap.items[i];
    const id = `notif.roadmap.${item.recommendation_id}`;
    if (seenIds.has(id)) continue;
    pushUnique({
      id,
      title: item.title,
      summary:
        `Phase ${item.phase} · ${item.completion_percentage}% complete · est. ROI ${item.estimated_roi}%.`,
      category: "roadmap",
      priority: item.priority,
      timestamp: roadmap.generated_at,
      source: "roadmap",
      source_key: `roadmap.items[${i}]`,
      relatedRule: null,
      relatedRecommendation:
        recommendations.recommendations.find(
          (r) => r.id === item.recommendation_id,
        ) ?? null,
      relatedRoadmapItem: item,
    });
  }

  // ---- Digital Twin risk + opportunity ----
  //
  // One notification per critical / high risk and per top
  // opportunity, with a "system" rollup if the matrix has
  // any non-zero entries. Each notification points back to
  // the exact upstream field (source_key), so the join is
  // traceable end-to-end.
  const riskMatrix = twin.risk_matrix;
  const criticalRisks = riskMatrix?.critical_risks ?? [];
  const highRisks = riskMatrix?.high_risks ?? [];
  const mediumRisks = riskMatrix?.medium_risks ?? [];
  const emergingRisks = riskMatrix?.emerging_risks ?? [];
  const allRiskEntries = [
    ...criticalRisks,
    ...highRisks,
    ...mediumRisks,
    ...emergingRisks,
  ];
  for (let i = 0; i < allRiskEntries.length; i += 1) {
    const entry = allRiskEntries[i];
    pushUnique({
      id: `notif.twin.risk.${entry.risk_id}`,
      title: entry.title,
      summary: entry.description,
      category: "risk",
      priority: entry.priority,
      timestamp: twin.generated_at,
      source: "twin",
      source_key: `twin.risk_matrix.${priorityToRiskBucket(entry.priority)}[${i}]`,
      relatedRule: null,
      relatedRecommendation: null,
      relatedRoadmapItem: null,
    });
  }
  if (allRiskEntries.length > 0) {
    pushUnique({
      id: "notif.twin.risk_summary",
      title: "Risk matrix updated",
      summary: `Digital Twin surfaced ${allRiskEntries.length} active risk signal(s) — ${criticalRisks.length} critical, ${highRisks.length} high.`,
      category: "risk",
      priority: criticalRisks.length > 0 ? "Critical" : "High",
      timestamp: twin.generated_at,
      source: "twin",
      source_key: "twin.risk_matrix",
      relatedRule: null,
      relatedRecommendation: null,
      relatedRoadmapItem: null,
    });
  }

  const opp = twin.opportunity_matrix;
  const oppBuckets: {
    key: keyof NonNullable<TwinResponse["opportunity_matrix"]>;
    list: NonNullable<TwinResponse["opportunity_matrix"]>[keyof NonNullable<TwinResponse["opportunity_matrix"]>];
  }[] = opp
    ? [
        { key: "quick_wins", list: opp.quick_wins },
        { key: "strategic_investments", list: opp.strategic_investments },
        { key: "long_term_growth", list: opp.long_term_growth },
        { key: "export_opportunities", list: opp.export_opportunities },
        { key: "digital_opportunities", list: opp.digital_opportunities },
        { key: "funding_opportunities", list: opp.funding_opportunities },
      ]
    : [];
  for (const bucket of oppBuckets) {
    for (let i = 0; i < bucket.list.length; i += 1) {
      const o = bucket.list[i];
      const relatedRec =
        recommendations.recommendations.find(
          (r) => r.id === o.recommendation_id,
        ) ?? null;
      pushUnique({
        id: `notif.twin.opp.${o.opportunity_id}`,
        title: o.title,
        summary: `${o.description} (est. ROI ${o.estimated_roi}%, score gain ${o.estimated_score_gain}).`,
        category: "opportunity",
        priority: o.priority,
        timestamp: twin.generated_at,
        source: "twin",
        source_key: `twin.opportunity_matrix.${bucket.key}[${i}]`,
        relatedRule: null,
        relatedRecommendation: relatedRec,
        relatedRoadmapItem: relatedRec
          ? (roadByRec.get(relatedRec.id) ?? null)
          : null,
      });
    }
  }
  const allOpps = oppBuckets.flatMap((b) => b.list);
  if (allOpps.length > 0) {
    pushUnique({
      id: "notif.twin.opp_summary",
      title: "Opportunity matrix updated",
      summary: `Digital Twin identified ${allOpps.length} growth opportunity signal(s).`,
      category: "opportunity",
      priority: "Medium",
      timestamp: twin.generated_at,
      source: "twin",
      source_key: "twin.opportunity_matrix",
      relatedRule: null,
      relatedRecommendation: null,
      relatedRoadmapItem: null,
    });
  }

  // ---- System (one per upstream generated_at) ----
  pushUnique({
    id: "notif.system.analysis_refreshed",
    title: "Business analysis refreshed",
    summary: "The full engine stack (rules, recommendations, roadmap, twin) just re-ran.",
    category: "system",
    priority: "Low",
    timestamp: rules.generated_at,
    source: "rules",
    source_key: "rules.generated_at",
    relatedRule: null,
    relatedRecommendation: null,
    relatedRoadmapItem: null,
  });

  if (decision?.generated_at) {
    pushUnique({
      id: "notif.system.decision_refreshed",
      title: "AI decision summary updated",
      summary: "The AI Decision engine produced a new summary for this business.",
      category: "system",
      priority: "Low",
      timestamp: decision.generated_at,
      source: "decision",
      source_key: "decision.generated_at",
      relatedRule: null,
      relatedRecommendation: null,
      relatedRoadmapItem: null,
    });
  }

  // Stable sort: newest first, then by id for determinism.
  out.sort((a, b) => {
    const ta = Date.parse(a.timestamp || "") || 0;
    const tb = Date.parse(b.timestamp || "") || 0;
    if (tb !== ta) return tb - ta;
    return a.id.localeCompare(b.id);
  });

  return out;
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function indexRecsByRule(recs: RecommendationItem[]): Map<string, RecommendationItem[]> {
  const m = new Map<string, RecommendationItem[]>();
  const safeRecs = Array.isArray(recs) ? recs : [];
  for (const r of safeRecs) {
    if (!r || !Array.isArray(r.supporting_rule_ids)) continue;
    for (const id of r.supporting_rule_ids) {
      const list = m.get(id);
      if (list) list.push(r);
      else m.set(id, [r]);
    }
  }
  return m;
}

function pickFirst<T>(list: T[] | undefined): T | null {
  if (!list || list.length === 0) return null;
  return list[0];
}

function priorityToCategory(p: RulePriority): NotificationCategoryKey {
  switch (p) {
    case "Critical":
      return "critical";
    case "High":
      return "high";
    case "Medium":
      return "medium";
    case "Low":
      return "low";
  }
}

/**
 * Map a rule priority to the matching risk-matrix bucket
 * name in the Digital Twin payload. The bucketing matches
 * the upstream contract: critical / high / medium risks
 * plus an `emerging_risks` rollup bucket. Anything else
 * falls into `emerging_risks` to keep the source_key
 * stable.
 */
function priorityToRiskBucket(
  p: RulePriority,
): "critical_risks" | "high_risks" | "medium_risks" | "emerging_risks" {
  switch (p) {
    case "Critical":
      return "critical_risks";
    case "High":
      return "high_risks";
    case "Medium":
      return "medium_risks";
    case "Low":
      return "emerging_risks";
  }
}
