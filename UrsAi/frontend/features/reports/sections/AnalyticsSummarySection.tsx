"use client";

import { ReportSection } from "../ReportSection";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import {
  levelToTone,
  scoreEdgeTone,
  scoreFill,
  scoreSurfaceTone,
} from "@/features/dashboard/tones";
import {
  READINESS_KEYS,
  scoreByKey,
} from "@/features/analytics/use-analytics-data";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "analytics-summary",
  id: "report-analytics-summary",
  badge: "Analytics",
  title: "Analytics Summary",
  caption: "Trends, readiness breakdown, and analytics overview.",
};

interface AnalyticsSummarySectionProps {
  data: ReportsData;
}

/**
 * Analytics Summary — the same six-pillar readiness breakdown
 * used by the analytics page, plus the timeline / projected
 * delta. Reuses the analytics page's READINESS_KEYS constant
 * so the list of pillars never drifts.
 */
export function AnalyticsSummarySection({ data }: AnalyticsSummarySectionProps) {
  const { twin, recommendations } = data;
  const profileCompletion = computeProfileCompletion(twin);
  const pillars = READINESS_KEYS.map((k) => {
    const found = scoreByKey(twin, k);
    if (!found) return null;
    return { ...found, key: k };
  }).filter((p): p is NonNullable<typeof p> => p !== null);
  const currentScore = twin.scores.overall_score;
  const projectedScore =
    twin.timeline.twelve_month.projected_overall_score;

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Overall business score"
          value={twin.current_health.overall_business_score}
          caption={twin.scores.overall_level}
        />
        <StatTile
          label="Business health"
          value={twin.health_summary.overall_health}
          caption="Composite readiness"
        />
        <StatTile
          label="Profile completion"
          value={profileCompletion}
          caption={twin.identity.is_completed ? "Complete" : "In progress"}
        />
        <StatTile
          label="DNA match"
          value={twin.current_health.business_dna_match}
          caption={twin.current_health.business_dna_archetype}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Current score
          </span>
          <span className="text-2xl font-semibold text-foreground">
            <AnimatedCounter value={currentScore} />
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Projected (12 mo)
          </span>
          <span className="text-2xl font-semibold text-primary">
            <AnimatedCounter value={projectedScore} />
          </span>
          <span className="text-xs text-muted-foreground">
            {projectedScore > currentScore
              ? `+${projectedScore - currentScore} lift from roadmap`
              : "Roadmap holding flat."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p) => {
          const level = (p.level ?? "Low") as "Low" | "Medium" | "High" | "Excellent";
          return (
            <div
              key={p.key}
              className={`flex flex-col gap-2 rounded-lg border border-border border-l-4 ${scoreEdgeTone(level)} ${scoreSurfaceTone(level)} p-3`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.title}</p>
                <LevelBadge level={level} tone={levelToTone(level)} />
              </div>
              <ProgressBar
                value={p.score}
                label="Score"
                hint={
                  <span className="inline-flex items-baseline gap-1">
                    <AnimatedCounter value={p.score} />
                    <span className="text-muted-foreground">/ 100</span>
                  </span>
                }
                fillClassName={scoreFill(level)}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Based on {recommendations.recommendations.length} recommendations
        and the current roadmap. Trends reflect the Digital Twin
        timeline projection, not a historical baseline.
      </p>
    </ReportSection>
  );
}

function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold text-foreground tabular-nums">
        <AnimatedCounter value={value} />
        <span className="text-xs text-muted-foreground"> / 100</span>
      </span>
      {caption && (
        <span className="text-xs text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}

// Reuse the analytics page's profile-completion helper so the
// number on the report matches the analytics page exactly.
function computeProfileCompletion(twin: ReportsData["twin"]): number {
  if (twin.identity.is_completed) return 100;
  const checks = [
    twin.profile.has_website,
    twin.profile.has_ecommerce,
    twin.profile.uses_digital_marketing,
    twin.profile.uses_cloud_systems,
    twin.profile.has_active_certification,
    twin.profile.has_iec_number,
    twin.profile.products_count > 0,
    twin.profile.goals_count > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
