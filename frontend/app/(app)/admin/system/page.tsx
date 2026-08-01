"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

/**
 * /admin/system — Sprint 8 Part 2.
 *
 * Read-only operator dashboard. Polls `GET /health` every 15s
 * and surfaces the six spec fields (Health / Version / Uptime /
 * Request count / Active requests / Average latency / Error
 * rate) plus a per-subsystem breakdown.
 *
 * The page does NOT add a new business surface — it is purely
 * observability glue and reuses the existing UI primitives
 * (DashboardCard, ProgressBar, StatusBadge, Skeleton,
 * ErrorState, EmptyState).
 *
 * Sprint 8 Part 4 — SystemView is loaded via `next/dynamic`
 * with SSR disabled. The /admin/system route is rare in
 * production (only operators open it), so deferring the
 * chunk until the user actually visits the page trims the
 * initial bundle size of every other authenticated route.
 */
const SystemView = dynamic(
  () =>
    import("@/features/admin").then((m) => ({ default: m.SystemView })),
  {
    ssr: false,
    loading: () => null,
  },
);

export default function AdminSystemPage() {
  return (
    <ProtectedRoute>
      <SystemView />
    </ProtectedRoute>
  );
}
