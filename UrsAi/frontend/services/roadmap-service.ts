/**
 * Service module — GET /business/roadmap
 */

import { apiClient } from "@/services/api-client";
import type { RoadmapResponse } from "@/types/analytics";

export const roadmapService = {
  compute: (): Promise<RoadmapResponse> =>
    apiClient.get<RoadmapResponse>("/api/v1/business/roadmap"),
};
