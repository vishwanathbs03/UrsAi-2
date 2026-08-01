"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AnalysisScreen } from "@/features/analysis/AnalysisScreen";

/**
 * /analysis — the post-create "Analyzing your business…" screen.
 *
 * The wizard routes here after a successful create, the analysis
 * pipeline runs for 3–5 seconds, then the user lands on /dashboard.
 */
export default function AnalysisPage() {
  return (
    <ProtectedRoute>
      <AnalysisScreen />
    </ProtectedRoute>
  );
}
