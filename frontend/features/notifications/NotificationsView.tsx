"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Building2, RefreshCcw } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationsOverview } from "./NotificationsOverview";
import { NotificationsFiltersBar } from "./NotificationsFiltersBar";
import { NotificationsList } from "./NotificationsList";
import { NotificationDetailPanel } from "./NotificationDetailPanel";
import {
  applyNotificationFilters,
  DEFAULT_NOTIFICATIONS_FILTERS,
  type NotificationsFilters,
} from "./use-notification-filters";
import {
  useNotificationsData,
  type NotificationItem,
} from "./use-notifications-data";
import { useNotificationReadStatus } from "./use-notification-read-status";

/**
 * Top-level Notifications Center view.
 *
 * The page renders five sections:
 *   1. Page header — last-event timestamp + Refresh
 *   2. Overview — five KPI tiles (Total / Unread / Critical /
 *      Recommendations / Roadmap Updates)
 *   3. Filter bar — category, priority, status, text search
 *   4. List — responsive grid of notification cards + a
 *      slide-over detail panel that opens when a card is
 *      clicked
 *   5. Read-state actions — Mark as Read, Mark All as Read,
 *      Clear Read Notifications (frontend state only)
 *
 * The `loading / no-business / error / ready` state machine
 * is the same one used by the dashboard / analytics /
 * action-board / reports / insights hooks.
 *
 * Read/unread state is held in localStorage by
 * `useNotificationReadStatus` — the spec explicitly forbids
 * backend notification storage, so the upstream payloads
 * are never modified.
 */
export function NotificationsView() {
  const { state, refresh, isFetching } = useNotificationsData();
  const read = useNotificationReadStatus();
  const [filters, setFilters] = useState<NotificationsFilters>(
    DEFAULT_NOTIFICATIONS_FILTERS,
  );
  const [openNotification, setOpenNotification] =
    useState<NotificationItem | null>(null);

  // Reset the open detail when the underlying data is replaced
  // (e.g. after a refresh) so the panel never shows a stale
  // reference.
  useEffect(() => {
    if (state.status !== "ready") {
      setOpenNotification(null);
    }
  }, [state]);

  const filteredNotifications = useMemo(() => {
    if (state.status !== "ready") return [] as NotificationItem[];
    return applyNotificationFilters(
      state.data.notifications,
      filters,
      read.isRead,
    );
  }, [state, filters, read.isRead]);

  const unreadCount = useMemo(() => {
    if (state.status !== "ready") return 0;
    return state.data.notifications.reduce(
      (acc, n) => acc + (read.isRead(n.id) ? 0 : 1),
      0,
    );
  }, [state, read.isRead, read.ready]);

  const handleOpen = useCallback((notification: NotificationItem) => {
    setOpenNotification(notification);
  }, []);
  const handleClose = useCallback(() => {
    setOpenNotification(null);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    if (state.status !== "ready") return;
    read.markAllRead(state.data.notifications.map((n) => n.id));
  }, [state, read]);

  const handleClearRead = useCallback(() => {
    read.clearRead();
  }, [read]);

  if (state.status === "loading") {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-4">
          <DashboardSkeleton rows={2} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
          </div>
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="building"
          title="No business profile yet"
          description={state.detail ||
            "Set up your business profile to start receiving AI alerts."
          }
          actionLabel="Create business profile"
          onAction={() => { if (typeof window !== "undefined") window.location.href = "/business"; }}
          secondaryActionLabel="See how alerts work"
          onSecondaryAction={() => { if (typeof window !== "undefined") window.location.href = "/"; }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load notifications"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const lastEventAt = state.data.notifications[0]?.timestamp ?? null;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <PageHeader
          lastEventAt={lastEventAt}
          isFetching={isFetching}
          onRefresh={refresh}
        />
        <NotificationsOverview
          data={state.data}
          unreadCount={unreadCount}
        />
        <NotificationsFiltersBar
          filters={filters}
          onChange={setFilters}
          filteredCount={filteredNotifications.length}
          totalCount={state.data.notifications.length}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead}
          onClearRead={handleClearRead}
        />
        <NotificationsList
          notifications={filteredNotifications}
          totalCount={state.data.notifications.length}
          isRead={read.isRead}
          onOpen={handleOpen}
          onToggleRead={read.toggleRead}
        />
      </div>

      <NotificationDetailPanel
        notification={openNotification}
        isRead={openNotification ? read.isRead(openNotification.id) : false}
        onClose={handleClose}
        onToggleRead={read.toggleRead}
      />
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Internal sub-components
// --------------------------------------------------------------------------- //

interface PageHeaderProps {
  lastEventAt: string | null;
  isFetching: boolean;
  onRefresh: () => void;
}

function PageHeader({ lastEventAt, isFetching, onRefresh }: PageHeaderProps) {
  return (
    <DashboardCard
      badge="Notifications"
      title="Notifications Center"
      caption="Critical, high, medium, low, recommendation, roadmap, risk, opportunity, and system events derived from the engine output."
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing notifications" : "Refresh notifications"}
        >
          <RefreshCcw
            className={cn(
              "size-4 transition-transform",
              isFetching && "animate-spin",
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isFetching ? "Refreshing" : "Refresh"}
          </span>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Bell className="size-3.5 text-primary" aria-hidden="true" />
          Last event
        </span>
        <span className="font-mono text-foreground">
          {lastEventAt ? formatTimestamp(lastEventAt) : "—"}
        </span>
      </div>
    </DashboardCard>
  );
}

function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
