/**
 * Service module — GET /api/v1/advisor
 *
 * The Autonomous Business Advisor is a read-only
 * aggregator over the five existing upstream payloads
 * (Twin, Rules, Recommendations, Roadmap, AI Decision /
 * Insights). The endpoint returns a deterministic
 * `AdvisorResponse` envelope with seven advice sections
 * plus a business summary and the inputs sidecar.
 *
 * This module is intentionally minimal: a single get
 * against the apiClient, matching the shape of every
 * other service in the codebase.
 */

import { apiClient } from "@/services/api-client";
import type { AdvisorResponse } from "@/types/advisor";

export const advisorService = {
  get: (): Promise<AdvisorResponse> =>
    apiClient.get<AdvisorResponse>("/api/v1/advisor"),
};
