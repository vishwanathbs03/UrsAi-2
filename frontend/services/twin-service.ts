/**
 * Service module — GET /business/twin
 */

import { apiClient } from "@/services/api-client";
import type { TwinResponse } from "@/types/analytics";

export const twinService = {
  compute: (): Promise<TwinResponse> =>
    apiClient.get<TwinResponse>("/api/v1/business/twin"),
};
