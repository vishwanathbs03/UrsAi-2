/**
 * Service module — GET /business/rules
 */

import { apiClient } from "@/services/api-client";
import type { RulesResponse } from "@/types/dashboard";

export const rulesService = {
  compute: (): Promise<RulesResponse> =>
    apiClient.get<RulesResponse>("/api/v1/business/rules"),
};
