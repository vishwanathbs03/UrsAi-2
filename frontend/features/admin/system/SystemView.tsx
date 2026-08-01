"use client";

import { useEffect } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SystemHealthOverview } from "./SystemHealthOverview";
import { SystemHealthSubsystems } from "./SystemHealthSubsystems";
import { useSystemHealth } from "./use-system-health";

/**
 * /admin/system — Sprint 8 Part 2.
 *
 * Read-only operator dashboard. Polls `GET /health` every 15s
 * and renders six KPI tiles (Health / Version / Uptime / Request
 * count / Active requests / Average latency / Error rate) plus a
 * per-subsystem breakdown.
 *
 * The component is intentionally synchronous-feeling: the only
 * state machine is `loading / ready / error / no-data`, mirroring
 * the other dashboard pages. There are no write actions, no
 * business logic, no AI.
 */
export function SystemView() {
  const { state, refresh, isFetching, lastFetchedAt } = useSystemHealth();

  // Reset the open detail when the underlying data is replaced
  // (e.g. after a refresh) so the panel never shows a stale
  // reference. (Kept for symmetry with the other dashboards; the
  // system page has no detail panel today.)
  useEffect(() => {
    void state;
  }, [state]);

  if (state.status === "loading") {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-4">
          <DashboardSkeleton rows={2} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
            <DashboardSkeleton rows={2} />
          </div>
          <DashboardSkeleton rows={4} />
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load system health"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const data = state.data;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <PageHeader
          isFetching={isFetching}
          lastFetchedAt={lastFetchedAt}
          onRefresh={refresh}
        />
        <SystemHealthOverview data={data} />
        <SystemHealthSubsystems data={data} />
      </div>
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Internal sub-components
// --------------------------------------------------------------------------- //

interface PageHeaderProps {
  isFetching: boolean;
  lastFetchedAt: number | null;
  onRefresh: () => void;
}

function PageHeader({ isFetching, lastFetchedAt, onRefresh }: PageHeaderProps) {
  return (
    <DashboardCard
      badge="System"
      title="System health"
      caption="Live operational view of the backend process. Read-only — no business data is touched."
      trailing={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing system health" : "Refresh system health"}
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
          <Activity className="size-3.5 text-primary" aria-hidden="true" />
          Last refresh
        </span>
        <span className="font-mono text-foreground">
          {lastFetchedAt ? formatTimestamp(new Date(lastFetchedAt).toISOString()) : "—"}
        </span>
      </div>
    </DashboardCard>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
