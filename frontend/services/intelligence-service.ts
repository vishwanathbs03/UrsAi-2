/**
 * Intelligence Service — GET /api/v1/business/intelligence (Sprint 11)
 */

import { apiClient } from "@/services/api-client";
import type { IntelligenceResponse } from "@/types/dashboard";

export const intelligenceService = {
  analyze: (): Promise<IntelligenceResponse> =>
    apiClient.get<IntelligenceResponse>("/api/v1/business/intelligence"),
  fetchFullIntelligence: (): Promise<IntelligenceResponse> =>
    apiClient.get<IntelligenceResponse>("/api/v1/business/intelligence"),
};
