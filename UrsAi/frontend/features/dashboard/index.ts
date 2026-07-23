"use client";

/**
 * Barrel for the dashboard feature module. Re-exports the hook
 * + each card so consumers can `import { DashboardView } from
 * "@/features/dashboard"`.
 */

export { DashboardView } from "./DashboardView";
export { useDashboardData } from "./use-dashboard-data";
export type {
  DashboardData,
  DashboardDataState,
  UseDashboardDataResult,
} from "./use-dashboard-data";
export {
  useIntelligenceQuery,
  useScoresQuery,
  useDnaQuery,
  useRulesQuery,
  useDecisionQuery,
} from "./use-dashboard-data";
