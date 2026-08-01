"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { GrowthAdvisorReport } from "@/types/advisor";
import { Clock, TrendingUp } from "lucide-react";

interface GrowthTipsProps {
  report: GrowthAdvisorReport;
}

export function GrowthTips({ report }: GrowthTipsProps) {
  return (
    <DashboardCard
      badge="Growth Engine"
      title="Strategic Growth Tips & Expansion Playbook"
      caption={`Growth Stage: ${report.growth_stage} (${report.total_advice_count} strategic recommendations).`}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {report.recommendations.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {item.title}
              </span>
              <LevelBadge
                level={item.priority}
                tone={levelToTone(item.priority)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{item.advice}</p>
            <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3 text-primary" />
                Timeline: <strong className="text-foreground">{item.timeline}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="size-3 text-emerald-500" />
                Impact: <strong className="text-foreground">{item.expected_impact}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
