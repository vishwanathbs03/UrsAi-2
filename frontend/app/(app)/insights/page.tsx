import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InsightsView } from "@/features/insights";

export const metadata: Metadata = {
  title: "Insights",
};

/**
 * Insights Center — Sprint 6 Part 3.
 *
 * Frontend only. Aggregates the existing AI Decision insights
 * and joins them with the matching rule firings, recommendations,
 * and roadmap items to surface a searchable, filterable
 * insights feed.
 */
export default function InsightsPage() {
  return (
    <ProtectedRoute>
      <InsightsView />
    </ProtectedRoute>
  );
}
