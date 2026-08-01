import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AnalyticsView } from "@/features/analytics";

export const metadata: Metadata = {
  title: "Analytics",
};

/**
 * Business Analytics Dashboard — Sprint 6 Part 1.
 *
 * Aggregates Digital Twin, Roadmap, and Recommendations
 * APIs into a single analytics view with interactive filters.
 */
export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsView />
    </ProtectedRoute>
  );
}
