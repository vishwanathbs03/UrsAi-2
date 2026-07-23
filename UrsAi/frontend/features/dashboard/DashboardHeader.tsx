"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, RefreshCcw, Sparkles } from "lucide-react";

interface DashboardHeaderProps {
  /** "last analyzed at" timestamp (ISO). */
  lastAnalyzedAt: string | null;
  onRefresh?: () => void;
  /** Show the spinner on the refresh button while a background
   *  re-fetch is in flight. Default false. */
  isRefreshing?: boolean;
}

/**
 * Welcome header — pinned at the top of the dashboard.
 * Shows the current user's name, a "refresh" button, and the
 * timestamp of the most recent analysis.
 *
 * Sprint 4: adds a visible "Refreshing" state on the
 * refresh button so the user knows a background re-fetch is
 * in flight (the cache hit will render instantly, so
 * without this the click would feel unresponsive).
 */
export function DashboardHeader({
  lastAnalyzedAt,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Burning the midnight oil";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const name = user?.full_name?.trim() || "there";

  return (
    <DashboardCard
      badge="Dashboard"
      title={`${greeting}, ${name}`}
      caption="A live view of your business — intelligence, scores, DNA, and the decisions Atlas thinks matter most."
      trailing={
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={
                isRefreshing ? "Refreshing dashboard" : "Refresh dashboard"
              }
            >
              <RefreshCcw
                className={cn(
                  "size-4 transition-transform",
                  isRefreshing && "animate-spin",
                )}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {isRefreshing ? "Refreshing" : "Refresh Analysis"}
              </span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
            aria-label="Sign out"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Last analysis
        </span>
        <span className="font-mono text-foreground">
          {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "—"}
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
    });
  } catch {
    return iso;
  }
}
