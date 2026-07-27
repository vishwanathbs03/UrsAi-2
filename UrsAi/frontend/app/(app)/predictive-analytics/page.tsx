import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PredictiveAnalyticsView } from "@/features/predictive-analytics";

export const metadata: Metadata = {
  title: "Predictive Analytics",
};

/**
 * Predictive Analytics — Sprint 6 Part 5.
 *
 * Frontend only. The 12-month deterministic projections
 * are read straight from the existing Digital Twin
 * `timeline` payload (no new endpoints, no new backend
 * logic, no LLM, no ML). The page reuses the same
 * TanStack Query pattern and the same
 * loading / no-business / error / ready state machine as
 * the analytics, insights, action-board, and
 * notifications pages.
 */
export default function PredictiveAnalyticsPage() {
  return (
    <ProtectedRoute>
      <PredictiveAnalyticsView />
    </ProtectedRoute>
  );
}
