"use client";

/**
 * Section 2 — Business Health.
 * Hero visualisation: Overall Health Score + Grade + Status +
 * Trend + One concise explanation. "What is driving this score?"
 * expands into the analyzer breakdown.
 *
 * Historical trend: ONLY renders if the intelligence payload
 * carries a real history series. Otherwise — explicitly — the
 * UI shows "Not enough historical data" rather than synthesising
 * a fake trend.
 */

import React from "react";
import { useState } from "react";
import type { IntelligenceResponse } from "@/types/dashboard";

interface BusinessHealthProps {
  intelligence?: IntelligenceResponse | null;
}

function levelLabel(level: string | undefined | null): string {
  if (!level) return "Unknown";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function gradeFromLevel(level: string | undefined | null): string {
  switch ((level || "").toLowerCase()) {
    case "excellent":
      return "A";
    case "high":
      return "B";
    case "medium":
      return "C";
    case "low":
      return "D";
    default:
      return "—";
  }
}

function statusCopy(level: string | undefined | null): string {
  switch ((level || "").toLowerCase()) {
    case "excellent":
      return "Strong and ready to scale";
    case "high":
      return "Strong, with room to scale";
    case "medium":
      return "Established but several dimensions lag";
    case "low":
      return "Foundational work needed";
    default:
      return "Status unknown";
  }
}

interface TrendPoint {
  label: string;
  score: number | null;
}

function buildTrendPoints(history: Array<{ months_ago: number; overall_score: number | null }>): TrendPoint[] {
  return history.map((p) => ({
    label: p.months_ago === 0 ? "Now" : `-${p.months_ago}mo`,
    score: p.overall_score,
  }));
}

export const BusinessHealth: React.FC<BusinessHealthProps> = ({ intelligence }) => {
  const [open, setOpen] = useState(false);

  if (!intelligence) return null;

  // P0.8 — Do NOT silently coerce a missing health score to 0.
  // When the score is absent we render the "Not yet assessed" state
  // instead of presenting a 0 as a legitimate measurement.
  const overall = intelligence.overall;
  const score: number | null =
    overall && typeof overall.score === "number" && Number.isFinite(overall.score)
      ? overall.score
      : null;
  const level = overall?.level;
  const grade = score != null ? gradeFromLevel(level) : "—";

  // Try to find a history series in the payload. If absent or empty,
  // we DO NOT fabricate a trend — we explicitly say so.
  const maybeHistory = (intelligence as unknown as {
    history?: Array<{ months_ago: number; overall_score: number | null }>;
    history_series?: Array<{ months_ago: number; overall_score: number | null }>;
  });
  const history = maybeHistory.history_series ?? maybeHistory.history;
  const hasGenuineHistory = Array.isArray(history) && history.length >= 2 && history.some((p) => p.overall_score != null);

  return (
    <section
      aria-labelledby="twin-section-health"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Section 2
          </span>
          <h2 id="twin-section-health" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
            Business Health
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the business stands right now.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Overall Health Score
          </span>
          <div className="text-6xl font-extrabold leading-none text-card-foreground">
            {score == null ? "—" : score}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border bg-card px-2 py-0.5 font-bold">
              Grade {grade}
            </span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 font-medium">
              {score == null ? "Not yet assessed" : levelLabel(level)}
            </span>
          </div>
          <p className="mt-1 max-w-[14rem] text-center text-xs text-muted-foreground">
            {score == null
              ? "Complete your business profile to surface a health score."
              : statusCopy(level)}
          </p>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Trend</h3>
            {hasGenuineHistory ? (
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {buildTrendPoints(history!).map((pt) => (
                  <li
                    key={pt.label}
                    className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-center"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pt.label}</div>
                    <div className="text-base font-bold text-card-foreground">
                      {pt.score == null ? "—" : pt.score}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-xs italic text-muted-foreground">
                Not enough historical data
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted"
            >
              {open ? "Hide drivers" : "What is driving this score?"}
              <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>

            {open && (
              <div className="mt-3 space-y-2">
                {(intelligence.analyzers || []).map((a) => {
                  const weight = a.breakdown.reduce((s, b) => s + (b.weight || 0), 0) || 1;
                  const earned = a.breakdown.reduce((s, b) => s + (b.earned || 0), 0);
                  const pct = Math.round((earned / Math.max(1, weight)) * 100);
                  return (
                    <div key={a.key} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-card-foreground">{a.title}</span>
                        <span className="text-muted-foreground">
                          {a.score}/100 · {pct}% earned
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
                      <ul className="mt-2 space-y-1 text-[11px]">
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
                        <p className="mt-2 text-[11px] italic text-muted-foreground">
                          Missing: {a.missing.join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs italic text-muted-foreground">
        Health = composite of {overall?.analyzer_count ?? 0} deterministic analyzer scores. No synthesis.
      </p>
    </section>
  );
};
