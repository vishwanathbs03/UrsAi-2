/**
 * Service module — GET /business/decision
 */

import { apiClient } from "@/services/api-client";
import type { AIDecisionResponse } from "@/types/dashboard";

export const decisionService = {
  compute: (): Promise<AIDecisionResponse> =>
    apiClient.get<AIDecisionResponse>("/api/v1/business/decision"),
};
