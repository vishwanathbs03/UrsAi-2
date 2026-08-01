"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { RecommendationReport } from "@/types/advisor";
import { Award, Zap } from "lucide-react";

interface RecommendationCardsProps {
  report: RecommendationReport;
}

export function RecommendationCards({ report }: RecommendationCardsProps) {
  return (
    <DashboardCard
      badge="Prioritized"
      title="Strategic Recommendations"
      caption={`Ranked by Priority Score across Health, Readiness, Risk, and Growth factors (${report.total_count} items).`}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {report.recommendations.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 transition-colors hover:border-border/80"
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
            <p className="text-xs text-muted-foreground">{item.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Zap className="size-3 text-amber-500" />
                Score: <strong className="text-foreground">{item.priority_score}/100</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Award className="size-3 text-primary" />
                Category: <strong className="text-foreground">{item.category}</strong>
              </span>
              <span>Impact: {item.impact}</span>
              <span>Effort: {item.effort}</span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
