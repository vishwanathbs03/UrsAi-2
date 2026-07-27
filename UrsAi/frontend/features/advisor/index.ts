/**
 * Public surface for the Autonomous Business Advisor
 * feature. Mirrors the barrel shape the dashboard,
 * insights, analytics, and notifications features use.
 */
export { AdvisorView } from "./AdvisorView";
export { AdvisorSummaryCard } from "./AdvisorSummaryCard";
export { AdvisorActionCard } from "./AdvisorActionCard";
export {
  useAdvisorData,
  useAdvisorQuery,
  type AdvisorData,
  type AdvisorDataState,
  type UseAdvisorDataResult,
} from "./use-advisor-data";
