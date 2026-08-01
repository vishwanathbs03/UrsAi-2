"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/70 dark:bg-muted/40", className)}
      aria-hidden="true"
    />
  );
}

export type KPICardTone =
  | "neutral"
  | "emerald"
  | "amber"
  | "indigo"
  | "rose"
  | "sky"
  | "purple";

export interface KPITrend {
  value: string | number;
  label?: string;
  direction?: "up" | "down" | "neutral";
}

export interface KPICardProps {
  label: string;
  value?: string | number | null;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: KPICardTone;
  trend?: KPITrend;
  isLoading?: boolean;
}

export function KPICard({
  label,
  value,
  subtext,
  icon,
  tone = "neutral",
  trend,
  isLoading = false,
}: KPICardProps) {
  if (isLoading) {
    return <KPICardSkeleton />;
  }

  const toneStyles: Record<
    KPICardTone,
    { card: string; iconBg: string; iconText: string }
  > = {
    neutral: {
      card: "border-border/60 bg-card hover:border-primary/40",
      iconBg: "bg-muted/80 text-muted-foreground",
      iconText: "text-muted-foreground",
    },
    emerald: {
      card: "border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.08] hover:border-emerald-500/50",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      iconText: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      card: "border-amber-500/20 bg-amber-500/[0.03] dark:bg-amber-500/[0.08] hover:border-amber-500/50",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      iconText: "text-amber-600 dark:text-amber-400",
    },
    indigo: {
      card: "border-indigo-500/20 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.08] hover:border-indigo-500/50",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      iconText: "text-indigo-600 dark:text-indigo-400",
    },
    rose: {
      card: "border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/[0.08] hover:border-rose-500/50",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      iconText: "text-rose-600 dark:text-rose-400",
    },
    sky: {
      card: "border-sky-500/20 bg-sky-500/[0.03] dark:bg-sky-500/[0.08] hover:border-sky-500/50",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      iconText: "text-sky-600 dark:text-sky-400",
    },
    purple: {
      card: "border-purple-500/20 bg-purple-500/[0.03] dark:bg-purple-500/[0.08] hover:border-purple-500/50",
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      iconText: "text-purple-600 dark:text-purple-400",
    },
  };

  const currentTone = toneStyles[tone] || toneStyles.neutral;
  const displayValue =
    value !== undefined && value !== null && value !== "" ? value : "—";

  return (
    <div
      role="region"
      aria-label={`${label} metric: ${displayValue}`}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
        currentTone.card
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div
            className={cn(
              "flex size-7 items-center justify-center rounded-lg transition-colors group-hover:scale-110",
              currentTone.iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          {typeof displayValue === "number" ? (
            <AnimatedCounter value={displayValue} />
          ) : (
            displayValue
          )}
        </span>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              trend.direction === "up" &&
                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              trend.direction === "down" &&
                "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              (!trend.direction || trend.direction === "neutral") &&
                "bg-muted text-muted-foreground"
            )}
          >
            {trend.direction === "up" && (
              <TrendingUp className="size-3" aria-hidden="true" />
            )}
            {trend.direction === "down" && (
              <TrendingDown className="size-3" aria-hidden="true" />
            )}
            {(!trend.direction || trend.direction === "neutral") && (
              <Minus className="size-3" aria-hidden="true" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/50 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-7 rounded-lg" />
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}
