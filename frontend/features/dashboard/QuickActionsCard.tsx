"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  FileText,
  BarChart3,
  ShieldAlert,
  Lock,
} from "lucide-react";

export interface QuickActionItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  enabled: boolean;
  disabledReason?: string;
  recommended?: boolean;
}

export interface QuickActionsCardProps {
  businessExists?: boolean;
  profileCompletion?: number;
  healthScore?: number;
  actions?: QuickActionItem[];
}

export function QuickActionsCard({
  businessExists = true,
  profileCompletion = 85,
  healthScore = 75,
  actions: customActions,
}: QuickActionsCardProps) {
  const defaultActions = useMemo<QuickActionItem[]>(() => {
    const isProfileIncomplete = profileCompletion < 100;
    const isHealthLow = healthScore < 80;

    return [
      {
        id: "complete-profile",
        label: "Complete Profile",
        description: isProfileIncomplete
          ? `${100 - profileCompletion}% remaining`
          : "100% complete",
        href: "/business",
        icon: <Building2 className="size-4 text-sky-500" aria-hidden="true" />,
        enabled: true,
        recommended: isProfileIncomplete,
      },
      {
        id: "improve-health",
        label: "Improve Health Score",
        description: `Current score: ${healthScore}/100`,
        href: "/advisor",
        icon: <ShieldAlert className="size-4 text-amber-500" aria-hidden="true" />,
        enabled: businessExists,
        disabledReason: !businessExists ? "Requires Business Profile" : undefined,
        recommended: isHealthLow && businessExists,
      },
      {
        id: "view-analytics",
        label: "View Intelligence & Scores",
        description: "Explore performance engines",
        href: "/business",
        icon: <BarChart3 className="size-4 text-indigo-500" aria-hidden="true" />,
        enabled: businessExists,
        disabledReason: !businessExists ? "Requires Business Profile" : undefined,
      },
      {
        id: "generate-report",
        label: "Generate Executive Report",
        description: "Export summary brief",
        href: "/reports",
        icon: <FileText className="size-4 text-emerald-500" aria-hidden="true" />,
        enabled: businessExists,
        disabledReason: !businessExists ? "Requires Business Profile" : undefined,
      },
    ];
  }, [businessExists, profileCompletion, healthScore]);

  const items = customActions || defaultActions;

  return (
    <DashboardCard
      badge="Actions"
      title="Quick Actions"
      caption="Context-aware shortcuts to optimize your business operating system."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          if (!item.enabled) {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 p-3.5 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted/80">
                    <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.disabledReason || "Action locked"}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Button
              key={item.id}
              asChild
              variant="outline"
              className={cn(
                "group relative flex h-auto items-center justify-between p-3.5 text-left transition-all duration-200 hover:border-primary/40 hover:shadow-sm",
                item.recommended && "border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.08]"
              )}
            >
              <Link href={item.href}>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted/80 transition-transform group-hover:scale-105">
                    {item.icon}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{item.label}</span>
                      {item.recommended && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                          Suggested
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
              </Link>
            </Button>
          );
        })}
      </div>
    </DashboardCard>
  );
}
