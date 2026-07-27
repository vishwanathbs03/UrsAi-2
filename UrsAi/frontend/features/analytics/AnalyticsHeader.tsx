"use client";

import { useMemo } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, RefreshCcw } from "lucide-react";

interface AnalyticsHeaderProps {
  lastAnalyzedAt: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * Analytics page header with refresh control and timestamp.
 */
export function AnalyticsHeader({
  lastAnalyzedAt,
  onRefresh,
  isRefreshing = false,
}: AnalyticsHeaderProps) {
  const subtitle = useMemo(
    () =>
      "Deep-dive into scores, recommendations, roadmap progress, risks, and opportunities.",
    [],
  );

  return (
    <DashboardCard
      badge="Analytics"
      title="Business Analytics Dashboard"
      caption={subtitle}
      trailing={
        onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing analytics" : "Refresh analytics"}
          >
            <RefreshCcw
              className={cn(
                "size-4 transition-transform",
                isRefreshing && "animate-spin",
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {isRefreshing ? "Refreshing" : "Refresh"}
            </span>
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="size-3.5 text-primary" aria-hidden="true" />
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
