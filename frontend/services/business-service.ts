/**
 * Service module — Business Digital Twin CRUD.
 *
 * Endpoints
 * ---------
 *   GET    /api/v1/business  — fetch the authenticated user's business
 *                              profile (with completeness sidecar)
 *   POST   /api/v1/business  — create the business profile (one per user)
 *   PUT    /api/v1/business  — partial update (any subset of sections)
 *   DELETE /api/v1/business  — remove the profile + every nested row
 *
 * Mirrors the backend routes in `backend/app/api/v1/endpoints/business.py`.
 * Wire shape is the Pydantic `BusinessWithCompleteness` envelope on read
 * and the `BusinessCreate` / `BusinessUpdate` payloads on write.
 */

import { apiClient } from "@/services/api-client";
import type {
  BusinessCreate,
  BusinessUpdate,
  BusinessWithCompleteness,
  DeleteResponse,
} from "@/types/business";

export const businessService = {
  get: (): Promise<BusinessWithCompleteness> =>
    apiClient.get<BusinessWithCompleteness>("/api/v1/business"),

  create: (payload: BusinessCreate): Promise<BusinessWithCompleteness> =>
    apiClient.post<BusinessWithCompleteness>("/api/v1/business", payload),

  update: (payload: BusinessUpdate): Promise<BusinessWithCompleteness> =>
    apiClient.put<BusinessWithCompleteness>("/api/v1/business", payload),

  delete: (): Promise<DeleteResponse> =>
    apiClient.delete<DeleteResponse>("/api/v1/business"),
};
