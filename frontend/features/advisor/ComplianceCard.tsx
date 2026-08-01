"use client";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { ComplianceReport } from "@/types/advisor";
import { Calendar, ShieldCheck } from "lucide-react";

interface ComplianceCardProps {
  report: ComplianceReport;
}

export function ComplianceCard({ report }: ComplianceCardProps) {
  return (
    <DashboardCard
      badge="Regulatory & Legal"
      title="Compliance & Regulatory Health"
      caption={`Overall Status: ${report.overall_status} (${report.total_requirements} core compliance checks).`}
    >
      <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-3">
        <ShieldCheck className="size-8 text-primary" />
        <div className="flex flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Compliance Score
          </span>
          <div className="flex items-baseline gap-1">
            <AnimatedCounter
              value={report.compliance_score}
              className="text-2xl font-bold text-foreground"
              durationMs={500}
            />
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="ml-auto">
          <LevelBadge
            level={report.overall_status}
            tone={levelToTone(report.overall_status)}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {report.items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {item.requirement}
              </span>
              <LevelBadge
                level={item.status}
                tone={levelToTone(item.status)}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Category: {item.category}</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" />
                {item.due_date}
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
