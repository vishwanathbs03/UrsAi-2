/**
 * Assistant header — page title, last-analysis timestamp,
 * Refresh and Clear Chat actions. Mirrors the Insights
 * header pattern so the visual rhythm is consistent
 * across the app.
 */

"use client";

import { Building2, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssistantHeaderProps {
  lastAnalyzedAt: string | null;
  isFetching: boolean;
  onRefresh: () => void;
  onClear: () => void;
  messageCount: number;
  /** Optional right-aligned controls (e.g. server-history toggle). */
  rightSlot?: React.ReactNode;
}

export function AssistantHeader({
  lastAnalyzedAt,
  isFetching,
  onRefresh,
  onClear,
  messageCount,
  rightSlot,
}: AssistantHeaderProps) {
  return (
    <DashboardCard
      badge="AI Assistant"
      title="AI Business Assistant"
      caption="Ask anything about your business. Responses are grounded in the Digital Twin, Recommendations, Roadmap, Insights, and Rules — no AI provider is called."
      trailing={
        <div className="flex items-center gap-2">
          {rightSlot}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={isFetching ? "Refreshing assistant data" : "Refresh assistant data"}
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={messageCount === 0}
            aria-label="Clear chat"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Clear Chat</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Deterministic · local
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="size-3.5 text-primary" aria-hidden="true" />
          Last analysis
        </span>
        <span className="font-mono text-foreground">
          {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "—"}
        </span>
        {messageCount > 0 && (
          <span className="ml-auto text-foreground/70">
            {messageCount} message{messageCount === 1 ? "" : "s"}
          </span>
        )}
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
