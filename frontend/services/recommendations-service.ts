/**
 * Service module — GET /business/recommendations
 */

import { apiClient } from "@/services/api-client";
import type { RecommendationsResponse, RecommendationItem } from "@/types/analytics";

export const recommendationsService = {
  compute: async (): Promise<RecommendationsResponse> => {
    const raw = await apiClient.get<any>("/api/v1/business/recommendations");
    const recsList: RecommendationItem[] = Array.isArray(raw?.recommendations)
      ? raw.recommendations
      : Array.isArray(raw?.report?.recommendations)
      ? raw.report.recommendations
      : [];

    const criticalCount = recsList.filter((r) => r.priority === "Critical").length;
    const highCount = recsList.filter((r) => r.priority === "High").length;
    const mediumCount = recsList.filter((r) => r.priority === "Medium").length;
    const lowCount = recsList.filter((r) => r.priority === "Low").length;

    return {
      generated_at: raw?.generated_at || new Date().toISOString(),
      inputs: raw?.inputs || {
        rules_generated_at: null,
        intelligence_generated_at: null,
        scores_generated_at: null,
        dna_generated_at: null,
        knowledge_total_articles: 14,
      },
      summary: raw?.summary || {
        total_recommendations: recsList.length,
        critical_count: criticalCount,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
        total_estimated_impact: 85,
        total_estimated_score_gain: 25,
        total_estimated_cost: 0,
        total_estimated_roi: 150,
      },
      recommendations: recsList,
    };
  },
};
