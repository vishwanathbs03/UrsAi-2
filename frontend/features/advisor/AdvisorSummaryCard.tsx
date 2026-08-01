"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone, scoreTone } from "@/features/dashboard/tones";
import { Building2, Clock, Dna, Sparkles } from "lucide-react";
import type { AdvisorResponse } from "@/types/advisor";

interface AdvisorSummaryCardProps {
  summary: AdvisorResponse["business_summary"];
  generatedAt: string | null;
}

/**
 * The advisor's "Business Summary" card — the deterministic
 * one-paragraph snapshot of the business. Reuses the same
 * LevelBadge + AnimatedCounter + scoreTone patterns the
 * dashboard's OverallHealthCard uses so the page feels
 * native to the rest of the app.
 */
export function AdvisorSummaryCard({
  summary,
  generatedAt,
}: AdvisorSummaryCardProps) {
  const overallScore = Number(summary.overall_score) || 0;
  const band = summary.band || summary.overall_level || "—";

  return (
    <DashboardCard
      badge="Advisor"
      title="Business Summary"
      caption="A deterministic, read-only snapshot of the business the advisor is observing."
      trailing={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          <span className="font-mono">
            {generatedAt ? formatTimestamp(generatedAt) : "—"}
          </span>
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <div
            className="flex size-20 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5"
            aria-label={`Overall business score ${overallScore} out of 100`}
          >
            <span className="flex flex-col items-center leading-none">
              <AnimatedCounter
                value={overallScore}
                className={`text-2xl font-semibold ${scoreTone(band)}`}
                durationMs={600}
              />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                /100
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Building2
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">Business</span>
              <span className="font-semibold text-foreground">
                {summary.legal_name || "Unnamed business"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Type</span>
              <span className="font-semibold text-foreground">
                {summary.industry || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Dna
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">DNA</span>
              <span className="font-semibold text-foreground">
                {summary.archetype || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Health
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Overall</span>
              <AnimatedCounter
                value={overallScore}
                className={`font-semibold ${scoreTone(band)}`}
                durationMs={500}
              />
              <span className="text-muted-foreground">/100</span>
            </span>
            <LevelBadge
              level={summary.overall_level || band}
              tone={levelToTone(summary.overall_level || band)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <Sparkles
              className="mr-1 inline size-3 align-text-bottom text-primary"
              aria-hidden="true"
            />
            {summary.headline || "No headline available."}
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
