"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { TwinRiskMatrix } from "@/types/analytics";

interface RiskAnalyticsProps {
  matrix: TwinRiskMatrix;
}

/**
 * Risk analytics — active, critical, resolved, and emerging risks
 * from the Digital Twin risk matrix.
 */
export function RiskAnalytics({ matrix }: RiskAnalyticsProps) {
  const activeCount =
    matrix.critical_risks.length +
    matrix.high_risks.length +
    matrix.medium_risks.length;

  const sections = [
    {
      label: "Active Risks",
      count: activeCount,
      items: [
        ...matrix.critical_risks,
        ...matrix.high_risks,
        ...matrix.medium_risks,
      ],
      tone: "high" as const,
    },
    {
      label: "Critical Risks",
      count: matrix.critical_risks.length,
      items: matrix.critical_risks,
      tone: "high" as const,
    },
    {
      label: "Resolved Risks",
      count: matrix.resolved_risks.length,
      items: matrix.resolved_risks,
      tone: "low" as const,
    },
    {
      label: "Emerging Risks",
      count: matrix.emerging_risks.length,
      items: matrix.emerging_risks,
      tone: "medium" as const,
    },
  ];

  return (
    <DashboardCard
      badge="Risks"
      title="Risk Analytics"
      caption="Rule-derived risk matrix from the Digital Twin."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sections.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/30 px-3 py-4 text-center"
          >
            <AnimatedCounter
              value={s.count}
              className="text-2xl font-semibold text-foreground"
            />
            <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Top risks
        </p>
        {activeCount === 0 ? (
          <p className="text-sm text-muted-foreground">No active risks detected.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...matrix.critical_risks, ...matrix.high_risks]
              .slice(0, 5)
              .map((risk) => (
                <li
                  key={risk.risk_id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{risk.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {risk.description}
                    </p>
                  </div>
                  <LevelBadge
                    level={risk.priority}
                    tone={levelToTone(risk.priority)}
                  />
                </li>
              ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
