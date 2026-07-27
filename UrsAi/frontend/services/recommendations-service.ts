/**
 * Service module — GET /business/recommendations
 */

import { apiClient } from "@/services/api-client";
import type { RecommendationsResponse } from "@/types/analytics";

export const recommendationsService = {
  compute: (): Promise<RecommendationsResponse> =>
    apiClient.get<RecommendationsResponse>("/api/v1/business/recommendations"),
};
