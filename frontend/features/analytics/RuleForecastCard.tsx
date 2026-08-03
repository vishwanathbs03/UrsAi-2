"use client";

/**
 * P0.1 — Rule-based forecast card.
 *
 * The previous version displayed a fixed "currentScore + 14" target
 * without explaining the assumption. That violated data credibility:
 * a fixed +14 looked like a guaranteed delta.
 *
 * This version derives a MODELLLED trajectory from the existing
 * recommendation engine (`topRecommended?.estimated_score_gain`):
 *   - Current value (verbatim from the twin)
 *   - Scenario value (current + top rec modelled gain)
 *   - Assumptions (rec title + rule-based scoring)
 *   - Modelled change (delta)
 *   - Limitations (scenario estimate — not a forecast)
 *
 * If the modelled gain is unavailable (no top rec), we explicitly
 * say "Scenario estimate unavailable from current data." — never
 * present a fabricated +14.
 */

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import type { AnalyticsData } from "./use-analytics-data";

interface RuleForecastCardProps {
  data: AnalyticsData;
}

export function RuleForecastCard({ data }: RuleForecastCardProps) {
  const currentScore = data.twin.current_health.overall_business_score;

  // Derive a scenario from the top-priority recommendation. If no recs
  // exist we explicitly do NOT fabricate a number.
  const topRec = data.recommendations?.recommendations?.[0];
  const modelledGain =
    topRec && typeof topRec.estimated_score_gain === "number"
      ? Math.min(100, currentScore + topRec.estimated_score_gain)
      : null;

  const hasScenario = modelledGain !== null && modelledGain > currentScore;

  return (
    <DashboardCard
      badge="Rule-Based Forecast"
      title="Deterministic Score Trajectory"
      caption="Modelled scenario from your current health score and the top rule-engine recommendation. This is a scenario estimate, not a forecast."
      data-testid="rule-forecast-card"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-around gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Current value
            </span>
            <span className="text-2xl font-black text-foreground">
              {currentScore} / 100
            </span>
          </div>

          <ArrowRight
            className="size-5 text-primary shrink-0 rotate-90 sm:rotate-0"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Scenario value (6m)
            </span>
            <span
              className={
                hasScenario
                  ? "text-2xl font-black text-primary"
                  : "text-2xl font-black text-muted-foreground"
              }
            >
              {hasScenario ? `${modelledGain} / 100` : "Unavailable"}
            </span>
          </div>

          <ArrowRight
            className="size-5 text-emerald-500 shrink-0 rotate-90 sm:rotate-0"
            aria-hidden="true"
          />

          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
              Modelled change
            </span>
            <span className="text-2xl font-black text-emerald-500">
              {hasScenario ? `+${(modelledGain - currentScore).toFixed(0)} pts` : "—"}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground/90">Assumptions</p>
          <ul className="mt-1 list-disc pl-4">
            <li>
              Source: top-priority recommendation from the rule engine —{" "}
              <span className="font-medium text-foreground/80">
                {topRec?.title ?? "No top recommendation available."}
              </span>
            </li>
            <li>
              Modelled gain:{" "}
              <span className="font-medium text-foreground/80">
                {topRec?.estimated_score_gain != null
                  ? `+${topRec.estimated_score_gain} pts under current rules`
                  : "No modelled gain available."}
              </span>
            </li>
          </ul>
          <p className="mt-2">
            <span className="font-semibold text-foreground/90">Limitations:</span>{" "}
            This is a scenario estimate derived from current data, not a
            forecast. Real outcomes depend on execution, market conditions,
            and external factors the rule engine does not model.
          </p>
          {!hasScenario && (
            <p className="mt-2 font-medium text-foreground/80">
              Scenario estimate unavailable from current data.
            </p>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
