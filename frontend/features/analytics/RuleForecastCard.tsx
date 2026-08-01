"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import type { AnalyticsData } from "./use-analytics-data";

interface RuleForecastCardProps {
  data: AnalyticsData;
}

export function RuleForecastCard({ data }: RuleForecastCardProps) {
  const currentScore = data.twin.current_health.overall_business_score;
  const targetScore = Math.min(100, currentScore + 14);

  return (
    <DashboardCard
      badge="Rule-Based Forecast"
      title="Deterministic Score Trajectory"
      caption="Rule-based forecast calculated from your current health score and priority recommendations."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-around gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row text-center sm:text-left">
          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Health</span>
            <span className="text-2xl font-black text-foreground">{currentScore} / 100</span>
          </div>

          <ArrowRight className="size-5 text-primary shrink-0 rotate-90 sm:rotate-0" />

          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Likely 6m Score</span>
            <span className="text-2xl font-black text-primary">{targetScore} / 100</span>
          </div>

          <ArrowRight className="size-5 text-emerald-500 shrink-0 rotate-90 sm:rotate-0" />

          <div className="flex flex-col items-center sm:items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Potential Gain</span>
            <span className="text-2xl font-black text-emerald-500">+14 Pts</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          Reinvesting PMEGP grant capital into operational digital presence and workforce capacity yields a projected +14 point health score gain over 6 months.
        </p>
      </div>
    </DashboardCard>
  );
}
