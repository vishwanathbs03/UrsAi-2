"use client";

import { Lightbulb, Target, TriangleAlert } from "lucide-react";
import { ReportSection } from "../ReportSection";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "executive-summary",
  id: "report-executive-summary",
  badge: "Summary",
  title: "Executive Summary",
  caption: "High-level read of where the business stands today.",
};

interface ExecutiveSummarySectionProps {
  data: ReportsData;
}

/**
 * Executive Summary — the highest-level read of the report.
 * Pulls from the AI Decision engine's narrative (when present)
 * and overlays the Digital Twin headline numbers so the
 * reader has both prose and figures in one section.
 *
 * No new calculations: every number comes from the
 * upstream payload verbatim.
 */
export function ExecutiveSummarySection({ data }: ExecutiveSummarySectionProps) {
  const { twin, decision, recommendations } = data;
  const ch = twin.current_health;
  const recSummary = recommendations.summary;

  const bullets: string[] = [];
  if (decision) {
    if (decision.decision.summary) {
      bullets.push(decision.decision.summary);
    }
    for (const s of decision.decision.top_strengths.slice(0, 2)) {
      bullets.push(`Strength: ${s}`);
    }
    for (const r of decision.decision.top_risks.slice(0, 2)) {
      bullets.push(`Risk: ${r}`);
    }
  }
  if (bullets.length === 0) {
    bullets.push(
      `Overall business score is ${twin.scores.overall_score} / 100 (${twin.scores.overall_level}).`,
    );
    bullets.push(
      `${recSummary.total_recommendations} recommendations have been prioritised, with a total estimated ROI of ${recSummary.total_estimated_roi}%.`,
    );
    bullets.push(
      `${ch.rule_critical_count} critical rule firings need attention.`,
    );
  }

  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryStat
          label="Overall business score"
          value={`${twin.scores.overall_score} / 100`}
          caption={twin.scores.overall_level}
        />
        <SummaryStat
          label="Business health"
          value={`${twin.health_summary.overall_health} / 100`}
          caption="Composite readiness"
        />
        <SummaryStat
          label="DNA match"
          value={`${ch.business_dna_match} / 100`}
          caption={ch.business_dna_archetype}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryStat
          label="Critical rule firings"
          value={ch.rule_critical_count.toString()}
          caption="Need immediate action"
        />
        <SummaryStat
          label="Recommendations"
          value={recSummary.total_recommendations.toString()}
          caption={`${recSummary.critical_count} critical · ${recSummary.high_count} high`}
        />
        <SummaryStat
          label="Total est. ROI"
          value={`${recSummary.total_estimated_roi}%`}
          caption={`${recSummary.total_recommendations} recommendations`}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Key takeaways
        </p>
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <Lightbulb
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="leading-snug">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {decision && decision.decision.top_strengths.length > 0 && (
          <div className="rounded-lg border border-border bg-emerald-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Top strengths
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
              {decision.decision.top_strengths.map((s) => (
                <li key={s} className="leading-snug">
                  <Target
                    className="mr-1 inline-block size-3 align-middle"
                    aria-hidden="true"
                  />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {decision && decision.decision.top_risks.length > 0 && (
          <div className="rounded-lg border border-border bg-rose-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
              Top risks
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
              {decision.decision.top_risks.map((r) => (
                <li key={r} className="leading-snug">
                  <TriangleAlert
                    className="mr-1 inline-block size-3 align-middle"
                    aria-hidden="true"
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ReportSection>
  );
}

function SummaryStat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-semibold text-foreground tabular-nums">
        {value}
      </span>
      {caption && (
        <span className="text-xs text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}
