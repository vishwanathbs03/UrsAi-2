import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ActionBoardView } from "@/features/action-board";

export const metadata: Metadata = {
  title: "Action Board",
};

/**
 * Interactive Action Board — Sprint 4, Part 2.
 *
 * Frontend only. Fetches the existing Rule Engine and
 * AI Decision endpoints, converts the rule firings into
 * Kanban-style action cards across three columns
 * (To Do / In Progress / Completed), and persists the
 * per-card column choice in browser local storage.
 *
 * The view is a client component (it owns data loading +
 * drag state) and is wrapped in <ProtectedRoute> so
 * unauthenticated visitors are redirected to /login.
 */
export default function ActionBoardPage() {
  return (
    <ProtectedRoute>
      <ActionBoardView />
    </ProtectedRoute>
  );
}
