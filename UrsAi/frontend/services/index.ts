/**
 * Service layer.
 *
 * Per-domain service modules (e.g. business, simulation) live here in
 * later milestones and call into the shared `apiClient`.
 */
export { apiClient, ApiError, apiRequest } from "./api-client";
export type { RequestOptions } from "./api-client";

export {
  authService,
  AuthServiceError,
  type LoginPayload,
  type RegisterPayload,
} from "./auth-service";

export { intelligenceService } from "./intelligence-service";
export { scoresService } from "./scores-service";
export { dnaService } from "./dna-service";
export { rulesService } from "./rules-service";
export { decisionService } from "./decision-service";
