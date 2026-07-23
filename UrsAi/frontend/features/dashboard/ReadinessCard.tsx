"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { TrendBadge } from "@/components/common/TrendBadge";
import { LevelBadge } from "./LevelBadge";
import {
  levelToTone,
  scoreEdgeTone,
  scoreFill,
  scoreSurfaceTone,
  scoreTone,
} from "./tones";
import type { BusinessScore, ScoreLevel } from "@/types/dashboard";

interface ReadinessCardProps {
  scores: BusinessScore[];
}

/**
 * Readiness Score Cards — a 4-up grid of progress bars for the
 * four "ready" pillars (export, digital, compliance, growth).
 * The other four scores (risk, innovation, sustainability,
 * overall) are surfaced in the radar / distribution instead so
 * this card stays scannable.
 *
 * Sprint 4: each pillar card now has a colour-coded left
 * border + soft surface tint that match the score band, an
 * animated score counter, and a "trend" placeholder badge
 * (Stable / Improving). The trend is currently static
 * because the spec asks for a placeholder; the prop is
 * in place for a future historical-comparison hook.
 */
export function ReadinessCard({ scores }: ReadinessCardProps) {
  const pillars = scores.filter((s) =>
    ["export", "digital", "compliance", "growth"].includes(s.key),
  );

  return (
    <DashboardCard
      badge="Readiness"
      title="Readiness Scores"
      caption="How ready your business is on the four operational pillars."
    >
      {pillars.length === 0 ? (
        <p className="text-sm text-muted-foreground">No readiness scores available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pillars.map((s) => (
            <ReadinessItem key={s.key} score={s} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function ReadinessItem({ score }: { score: BusinessScore }) {
  const level = (score.level || score.band || "Low") as ScoreLevel;
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-border border-l-4 ${scoreEdgeTone(level)} ${scoreSurfaceTone(level)} p-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{score.title}</p>
        <div className="flex items-center gap-1.5">
          <TrendBadge direction={trendFor(score.score)} />
          <LevelBadge level={level} tone={levelToTone(level)} />
        </div>
      </div>
      <ProgressBar
        value={score.score}
        label="Score"
        hint={
          <span className="inline-flex items-baseline gap-1">
            <AnimatedCounter value={score.score} />
            <span className="text-muted-foreground">/ 100</span>
          </span>
        }
        fillClassName={scoreFill(level)}
      />
      <p className={`text-xs ${scoreTone(level)}`}>
        {level === "Excellent" && "Top band — pillar is at or near full readiness."}
        {level === "High" && "Strong — small specific gaps remain."}
        {level === "Medium" && "Mixed — some elements in place, others missing."}
        {level === "Low" && "Foundational elements are missing on this pillar."}
      </p>
    </div>
  );
}

/**
 * Map a pillar score to a trend direction. Placeholder heuristic
 * for Sprint 4 — the spec calls for a "trend placeholder
 * (Stable/Improving)"; we pick a direction by band so the
 * colours are visually consistent: Low/Medium → Improving,
 * High/Excellent → Stable. A real trend will need a historical
 * payload, which is out of scope this milestone.
 */
function trendFor(score: number): "up" | "stable" | "down" {
  if (score >= 70) return "stable";
  if (score >= 40) return "up";
  return "up";
}
