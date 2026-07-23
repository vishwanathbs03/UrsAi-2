/**
 * Service module — GET /business/scores
 */

import { apiClient } from "@/services/api-client";
import type { ScoresResponse } from "@/types/dashboard";

export const scoresService = {
  compute: (): Promise<ScoresResponse> =>
    apiClient.get<ScoresResponse>("/api/v1/business/scores"),
};
