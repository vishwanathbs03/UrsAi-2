"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  Calendar,
  FileText,
  LogOut,
  RefreshCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface DashboardHeaderProps {
  /** "last analyzed at" timestamp (ISO). */
  lastAnalyzedAt: string | null;
  onRefresh?: () => void;
  /** Show the spinner on the refresh button while a background
   *  re-fetch is in flight. Default false. */
  isRefreshing?: boolean;
}

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

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const name = user?.full_name?.trim() || "Executive";

  return (
    <DashboardCard
      badge="Executive Briefing"
      className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 shadow-soft"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left Welcome Area */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Calendar className="size-3.5 text-primary" aria-hidden="true" />
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
              <TrendingUp className="size-3" /> Live Engine Active
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {greeting}, <span className="text-primary">{name}</span>
          </h1>

          <p className="max-w-xl text-xs text-muted-foreground sm:text-sm leading-relaxed">
            Welcome back! Your Business Digital Twin is active. Review your 8-category health score, government subsidy opportunities, and priority recommendations below.
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Last analysis run:
            </span>
            <span className="font-mono font-semibold text-foreground">
              {lastAnalyzedAt ? formatTimestamp(lastAnalyzedAt) : "Just now"}
            </span>
          </div>
        </div>

        {/* Right CTA Actions Area */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button asChild size="sm" className="gap-2 shadow-md shadow-primary/20">
            <Link href="/business">
              <Building2 className="size-4" />
              Update Business Profile
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link href="/reports">
              <FileText className="size-4 text-primary" />
              Generate Report
            </Link>
          </Button>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Refreshing dashboard" : "Refresh dashboard"}
              title="Refresh Analysis"
            >
              <RefreshCcw
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  isRefreshing && "animate-spin text-primary",
                )}
                aria-hidden="true"
              />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign Out"
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </div>
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
