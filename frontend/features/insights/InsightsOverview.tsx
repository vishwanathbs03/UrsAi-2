"use client";

import { useId } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { confidenceToTone, levelToTone } from "@/features/dashboard/tones";
import { Lightbulb, Sparkles, Target, Activity } from "lucide-react";
import type { InsightsData } from "./use-insights-data";

interface InsightsOverviewProps {
  data: InsightsData;
}

/**
 * AI Insights Overview — four KPI tiles:
 *  - Overall Business Health (Digital Twin)
 *  - Overall Confidence (DNA engine)
 *  - Business DNA Archetype (DNA engine)
 *  - Total Insights (AI Decision)
 *
 * Every value is read straight from the upstream payload.
 * No re-derivation.
 */
export function InsightsOverview({ data }: InsightsOverviewProps) {
  const health = data.twin.current_health.overall_business_score;
  const dnaConfidence = data.twin.current_health.business_dna_match;
  const archetype = data.twin.current_health.business_dna_archetype;
  const totalInsights = data.insights.length;

  const dnaConf = confidenceToTone(dnaConfidence);
  const healthTone = levelToTone(
    health >= 70 ? "high" : health >= 40 ? "medium" : "low",
  );

  return (
    <div
      role="region"
      aria-label="Insights overview"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <OverviewTile
        icon={<Activity className="size-4" aria-hidden="true" />}
        badge="Health"
        title="Overall Business Health"
        value={health}
        suffix="/ 100"
        caption={data.twin.scores.overall_level}
        tone={healthTone}
      />
      <OverviewTile
        icon={<Target className="size-4" aria-hidden="true" />}
        badge="DNA"
        title="Overall Confidence"
        value={dnaConfidence}
        suffix="%"
        caption={dnaConf.label}
        tone={dnaConf.tone}
      />
      <OverviewTile
        icon={<Sparkles className="size-4" aria-hidden="true" />}
        badge="Archetype"
        title="Business DNA Archetype"
        // Archetype is a string, not a number — render it
        // as a large label with the numeric match as caption.
        text={archetype || "Unknown"}
        caption={
          archetype
            ? `Match ${dnaConfidence} / 100`
            : "No DNA match yet"
        }
      />
      <OverviewTile
        icon={<Lightbulb className="size-4" aria-hidden="true" />}
        badge="Insights"
        title="Total Insights"
        value={totalInsights}
        caption={
          totalInsights === 0
            ? "AI engine has no insights yet"
            : `from ${data.decision.inputs.model || "the AI engine"}`
        }
        tone="bg-secondary text-muted-foreground"
      />
    </div>
  );
}

interface OverviewTileProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  value?: number;
  text?: string;
  suffix?: string;
  caption?: string;
  tone?: string;
}

function OverviewTile({
  icon,
  badge,
  title,
  value,
  text,
  suffix,
  caption,
  tone,
}: OverviewTileProps) {
  const id = useId();
  return (
    <DashboardCard badge={badge} title={title} compact>
      <div className="flex items-center gap-3">
        <span
          className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          {text !== undefined ? (
            <span
              id={id}
              className="truncate text-lg font-semibold text-foreground"
            >
              {text}
            </span>
          ) : (
            <span
              id={id}
              className="text-2xl font-semibold text-foreground tabular-nums"
            >
              <AnimatedCounter value={value ?? 0} suffix={suffix} />
            </span>
          )}
          {caption && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {tone ? <LevelBadge level={caption} tone={tone} /> : caption}
            </span>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
