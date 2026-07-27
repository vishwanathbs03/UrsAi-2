import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NotificationsView } from "@/features/notifications";

export const metadata: Metadata = {
  title: "Notifications",
};

/**
 * Notifications Center — Sprint 6 Part 4.
 *
 * Frontend only. Derives the notification feed from the
 * five existing upstream payloads (twin / rules /
 * recommendations / roadmap / decision) — no new
 * endpoints, no backend notification storage. Read/unread
 * state is held in localStorage per the spec.
 */
export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsView />
    </ProtectedRoute>
  );
}
