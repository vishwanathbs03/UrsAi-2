"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { RiskReport } from "@/types/advisor";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface RiskCardsProps {
  report: RiskReport;
}

export function RiskCards({ report }: RiskCardsProps) {
  return (
    <DashboardCard
      badge="Risk Matrix"
      title="Risk Detection & Vulnerability Assessment"
      caption={`Overall Risk Level: ${report.overall_risk_level} (${report.total_risks_detected} detected risks).`}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {report.risks.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-rose-500" />
                <span className="text-sm font-semibold text-foreground">
                  {item.risk}
                </span>
              </div>
              <LevelBadge
                level={item.severity}
                tone={levelToTone(item.severity)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Mitigation:</strong> {item.recommendation}
            </p>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="size-3 text-amber-500" />
              Category: <span className="font-semibold text-foreground">{item.category}</span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
