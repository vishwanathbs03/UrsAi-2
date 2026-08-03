"use client";

/**
 * P0.2 — Scheme eligibility chart.
 *
 * The previous version showed fixed percentages (PMEGP 95 / CGTMSE 88 /
 * MUDRA 81 / Startup India 74) hardcoded as static matches. That
 * fabricated matching data the rule engine never actually produced.
 *
 * This version derives the rows from the live scheme-engine payload
 * passed via props. When no payload is provided we explicitly say
 * "Match score unavailable." — never a fabricated percentage.
 */

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Landmark, Info } from "lucide-react";

export interface SchemeMatch {
  name: string;
  match: number | null; // 0..100, or null when unknown
  subsidy?: string;
}

interface SchemeEligibilityChartProps {
  schemes?: SchemeMatch[] | null;
}

const FALLBACK_PROBE: SchemeMatch[] = [];

export function SchemeEligibilityChart({
  schemes,
}: SchemeEligibilityChartProps = { schemes: FALLBACK_PROBE }) {
  const rows = schemes ?? [];

  return (
    <DashboardCard
      badge="Scheme Matching"
      title="Government Scheme Match"
      caption="Match scores derived from the live scheme engine against your business profile. No fabricated values."
      data-testid="scheme-eligibility-chart"
    >
      {rows.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground/90">Match score unavailable.</p>
            <p className="mt-1">
              No matching-scheme data for the current business profile. Set up or
              complete your business profile to surface scheme matches.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {rows.map((s) => {
            const pct =
              typeof s.match === "number" && Number.isFinite(s.match)
                ? Math.max(0, Math.min(100, s.match))
                : null;
            return (
              <div
                key={s.name}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground truncate flex items-center gap-1.5">
                    <Landmark className="size-3.5 text-teal-500 shrink-0" aria-hidden="true" />
                    {s.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-teal-500/10 px-2 py-0.5 font-extrabold text-teal-500">
                    {pct === null ? "Match score unavailable" : `${pct}% Match`}
                  </span>
                </div>
                {pct !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {s.subsidy && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {s.subsidy}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
