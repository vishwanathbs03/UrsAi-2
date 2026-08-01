"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/common/EmptyState";
import { NotificationCard } from "./NotificationCard";
import type { NotificationItem } from "./use-notifications-data";

interface NotificationsListProps {
  notifications: NotificationItem[];
  totalCount: number;
  isRead: (id: string) => boolean;
  onOpen: (notification: NotificationItem) => void;
  onToggleRead: (id: string) => void;
}

/**
 * Responsive grid of NotificationCards. 1 column on mobile,
 * 2 on lg+. Shows an EmptyState when filters narrow the
 * list to zero so the user knows it's the filter, not a
 * missing data source.
 */
export function NotificationsList({
  notifications,
  totalCount,
  isRead,
  onOpen,
  onToggleRead,
}: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <DashboardCard badge="Notifications" title="No notifications match">
        <EmptyState
          illustration="bell"
          title="No notifications to show"
          description={
            totalCount === 0
              ? "The engine has not produced any events yet — try refreshing the analysis."
              : "Try clearing one of the filters to widen the search."
          }
          actionLabel="Refresh notifications"
          onAction={() => { if (typeof window !== "undefined") window.location.href = "/notifications"; }}
        />
      </DashboardCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        aria-live="polite"
      >
        {notifications.length} of {totalCount} notification
        {totalCount === 1 ? "" : "s"} match the active filters
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {notifications.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            isRead={isRead(n.id)}
            onOpen={onOpen}
            onToggleRead={onToggleRead}
          />
        ))}
      </div>
    </div>
  );
}
