"use client";

/**
 * Section 4 — Top Strengths.
 * Maximum 3, sorted by impact (high → medium → low) then by
 * order of appearance. Each strength shows Title + Why it
 * matters. Source = swot.strengths from the intelligence
 * payload. Empty array → friendly "No strengths detected yet"
 * fallback (no fake items).
 */

import React from "react";
import type { IntelligenceResponse } from "@/types/dashboard";
import type { SWOTItem } from "@/types/intelligence";
import { InsightChip } from "@/components/intelligence/InsightChip";

interface TopStrengthsProps {
  intelligence?: IntelligenceResponse | null;
}

const IMPACT_RANK: Record<SWOTItem["impact"], number> = { high: 0, medium: 1, low: 2 };

function pick(strengths: SWOTItem[] | undefined, max = 3): SWOTItem[] {
  if (!strengths || strengths.length === 0) return [];
  return [...strengths]
    .sort((a, b) => (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9))
    .slice(0, max);
}

export const TopStrengths: React.FC<TopStrengthsProps> = ({ intelligence }) => {
  if (!intelligence) return null;
  const items = pick(intelligence.swot?.strengths);

  return (
    <section
      aria-labelledby="twin-section-strengths"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Section 4
        </span>
        <h2 id="twin-section-strengths" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
          Top Strengths
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">What is working well.</p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-xs italic text-muted-foreground">
          No strengths detected yet — complete your business profile to surface them.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((s, idx) => (
            <li
              key={`${s.title}-${idx}`}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-card-foreground">{s.title}</h3>
                <InsightChip label={`Impact: ${s.impact}`} variant={s.impact === "high" ? "high" : s.impact === "medium" ? "medium" : "low"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Why it matters:</span> {s.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
