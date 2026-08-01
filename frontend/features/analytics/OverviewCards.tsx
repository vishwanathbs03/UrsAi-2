"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { CircularScore } from "@/components/dashboard/CircularScore";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import {
  computeProfileCompletion,
  type AnalyticsData,
} from "./use-analytics-data";

interface OverviewCardsProps {
  data: AnalyticsData;
}

/**
 * Analytics overview — four KPI tiles: overall score, health,
 * profile completion, and DNA match.
 */
export function OverviewCards({ data }: OverviewCardsProps) {
  const { twin } = data;
  const profileCompletion = computeProfileCompletion(twin);

  const kpis = [
    {
      label: "Overall Business Score",
      value: twin.current_health.overall_business_score,
      caption: twin.scores.overall_level,
      tone: levelToTone(twin.scores.overall_level),
    },
    {
      label: "Business Health",
      value: twin.health_summary.overall_health,
      caption: "Composite readiness",
      tone: levelToTone(
        twin.health_summary.overall_health >= 70
          ? "high"
          : twin.health_summary.overall_health >= 40
            ? "medium"
            : "low",
      ),
    },
    {
      label: "Profile Completion",
      value: profileCompletion,
      caption: twin.identity.is_completed ? "Complete" : "In progress",
      tone: levelToTone(
        profileCompletion >= 80 ? "high" : profileCompletion >= 50 ? "medium" : "low",
      ),
    },
    {
      label: "Business DNA Match",
      value: twin.current_health.business_dna_match,
      caption: twin.current_health.business_dna_archetype,
      tone: levelToTone(
        twin.current_health.business_dna_match >= 70
          ? "high"
          : twin.current_health.business_dna_match >= 40
            ? "medium"
            : "low",
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <DashboardCard key={kpi.label} badge="Overview" title={kpi.label} compact>
          <div className="flex items-center gap-4">
            <CircularScore
              value={kpi.value}
              size={88}
              thickness={8}
              caption={kpi.caption}
              ariaLabel={kpi.label}
            />
            <div className="flex flex-col gap-1">
              <AnimatedCounter
                value={kpi.value}
                suffix="/100"
                className="text-lg font-semibold text-foreground"
              />
              <LevelBadge level={kpi.caption} tone={kpi.tone} />
            </div>
          </div>
        </DashboardCard>
      ))}
    </div>
  );
}
