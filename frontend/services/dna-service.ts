/**
 * Service module — GET /business/dna
 */

import { apiClient } from "@/services/api-client";
import type { DnaResponse } from "@/types/dashboard";

export const dnaService = {
  compute: (): Promise<DnaResponse> =>
    apiClient.get<DnaResponse>("/api/v1/business/dna"),
};
