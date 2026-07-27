"use client";

import { ReportSection } from "../ReportSection";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "risk-summary",
  id: "report-risk-summary",
  badge: "Risks",
  title: "Risk Summary",
  caption: "Critical, active, resolved, and emerging risks.",
};

interface RiskSummarySectionProps {
  data: ReportsData;
}

/**
 * Risk Summary — four risk buckets and the top risks table.
 * Pulled directly from the Digital Twin risk matrix.
 */
export function RiskSummarySection({ data }: RiskSummarySectionProps) {
  const matrix = data.twin.risk_matrix;
  const active =
    matrix.critical_risks.length +
    matrix.high_risks.length +
    matrix.medium_risks.length;

  const sections = [
    { label: "Active", count: active, tone: "high" as const },
    { label: "Critical", count: matrix.critical_risks.length, tone: "high" as const },
    { label: "Resolved", count: matrix.resolved_risks.length, tone: "low" as const },
    { label: "Emerging", count: matrix.emerging_risks.length, tone: "medium" as const },
  ];

  const top = [...matrix.critical_risks, ...matrix.high_risks].slice(0, 8);

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sections.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/30 px-3 py-4 text-center"
          >
            <span className="text-2xl font-semibold text-foreground">
              <AnimatedCounter value={s.count} />
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Top critical / high risks
        </p>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No critical or high risks detected.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {top.map((risk) => (
              <li
                key={risk.risk_id}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {risk.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {risk.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {risk.estimated_impact}
                  </span>
                  <LevelBadge
                    level={risk.priority}
                    tone={levelToTone(risk.priority)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReportSection>
  );
}
