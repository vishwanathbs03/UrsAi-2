"use client";

/**
 * Section 3 — Business Readiness.
 * Concise readiness view across 5 dimensions:
 *   Financial, Operational, Digital, Compliance, Export.
 *
 * Sourced from `intelligence.analyzers` filtered by key —
 * financial / operational / digital / compliance / export.
 * Each dimension renders as a horizontal comparison bar with a
 * "Why is this score like this?" expandable panel.
 *
 * If no matching analyzer is found for a given dimension, that
 * row shows a placeholder ("Not yet assessed") rather than
 * fabricating a number. If fewer than 5 analyzers exist, we do
 * NOT duplicate dimensions — we render what we actually have.
 */

import React from "react";
import { useState } from "react";
import type { IntelligenceResponse, IntelligenceAnalyzer } from "@/types/dashboard";

interface BusinessReadinessProps {
  intelligence?: IntelligenceResponse | null;
}

// H5.1 brief specifies 5 dimensions. We match each to a real
// analyzer key produced by the backend. Keys may vary by
// schema version, so we keep a small list of candidates per
// dimension.
const DIMENSION_KEYS: Array<{ label: string; candidates: string[] }> = [
  { label: "Financial", candidates: ["financial_health", "finance", "financial"] },
  { label: "Operational", candidates: ["operational_health", "operations", "operational"] },
  { label: "Digital", candidates: ["digital_presence", "digital_maturity", "digital"] },
  { label: "Compliance", candidates: ["compliance_health", "compliance"] },
  { label: "Export", candidates: ["export_readiness", "export"] },
];

function findAnalyzer(
  analyzers: IntelligenceAnalyzer[] | undefined,
  candidates: string[],
): IntelligenceAnalyzer | undefined {
  if (!analyzers) return undefined;
  for (const c of candidates) {
    const hit = analyzers.find((a) => a.key === c);
    if (hit) return hit;
  }
  return undefined;
}

function barColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-cyan-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function levelLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export const BusinessReadiness: React.FC<BusinessReadinessProps> = ({ intelligence }) => {
  const [openDim, setOpenDim] = useState<string | null>(null);

  if (!intelligence) return null;

  const dimensions = DIMENSION_KEYS.map((d) => ({
    label: d.label,
    analyzer: findAnalyzer(intelligence.analyzers, d.candidates),
  }));

  const assessed = dimensions.filter((d) => d.analyzer).length;

  return (
    <section
      aria-labelledby="twin-section-readiness"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Section 3
          </span>
          <h2 id="twin-section-readiness" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
            Business Readiness
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {assessed} of {dimensions.length} dimensions assessed.
          </p>
        </div>
      </header>

      <ul className="space-y-3">
        {dimensions.map((d) => {
          const a = d.analyzer;
          const isOpen = openDim === d.label;
          const score = a?.score ?? 0;
          return (
            <li
              key={d.label}
              className="rounded-lg border border-border/40 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-card-foreground">{d.label}</span>
                  {!a && (
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Not yet assessed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {a && (
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 font-bold tabular-nums">
                      {score}/100 · {levelLabel(score)}
                    </span>
                  )}
                  {a && (
                    <button
                      type="button"
                      onClick={() => setOpenDim(isOpen ? null : d.label)}
                      aria-expanded={isOpen}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground transition-all hover:bg-muted"
                    >
                      {isOpen ? "Hide" : "Why?"}
                    </button>
                  )}
                </div>
              </div>

              {a && (
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${barColor(score)} transition-all duration-500 ease-out`}
                    style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                  />
                </div>
              )}

              {isOpen && a && (
                <div className="mt-2.5 space-y-1 text-[11px]">
                  <p className="italic text-muted-foreground">{a.summary}</p>
                  <ul className="mt-1 space-y-0.5">
                    {a.breakdown
                      .filter((b) => b.weight > 0)
                      .map((b) => (
                        <li
                          key={b.key}
                          className="flex items-center justify-between text-muted-foreground"
                        >
                          <span>
                            {b.present ? "✓" : "○"} {b.label}
                          </span>
                          <span className="tabular-nums">
                            {Math.round(b.earned)} / {Math.round(b.weight)}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {a.missing && a.missing.length > 0 && (
                    <p className="text-muted-foreground">Missing: {a.missing.join(", ")}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs italic text-muted-foreground">
        Each dimension maps to a single analyzer score; missing dimensions show &ldquo;Not yet assessed&rdquo;
        rather than a placeholder.
      </p>
    </section>
  );
};
