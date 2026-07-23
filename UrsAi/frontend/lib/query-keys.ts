/**
 * Centralised TanStack Query keys for the dashboard's
 * five upstream payloads plus the action-board pair.
 *
 * Why centralise: when we add mutation / invalidation
 * later ("Refresh" button → invalidate these), having one
 * source of truth prevents drift between the keys used
 * to read and the keys used to invalidate.
 */

export const queryKeys = {
  // Per-business analytical payloads.
  intelligence: () => ["business", "intelligence"] as const,
  scores: () => ["business", "scores"] as const,
  dna: () => ["business", "dna"] as const,
  rules: () => ["business", "rules"] as const,
  decision: () => ["business", "decision"] as const,
  // The bundled "dashboard" namespace — handy for the
  // "Refresh" button which invalidates everything at once.
  dashboardAll: () => ["business", "dashboard"] as const,
  actionBoardAll: () => ["business", "action-board"] as const,
};
