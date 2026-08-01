import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdvisorView } from "@/features/advisor";

export const metadata: Metadata = {
  title: "Advisor",
};

/**
 * Autonomous Business Advisor — Sprint 7 Part 5.
 *
 * Frontend only. The view is a client component (it owns
 * data loading + state) and is wrapped in
 * <ProtectedRoute> so unauthenticated visitors are redirected.
 *
 * The advisor is read-only — the page never renders
 * action-trigger buttons. The seven sections + the
 * business summary + the inputs sidecar are all derived
 * from the existing GET /api/v1/advisor endpoint that the
 * backend exposes.
 */
export default function AdvisorPage() {
  return (
    <ProtectedRoute>
      <AdvisorView />
    </ProtectedRoute>
  );
}
