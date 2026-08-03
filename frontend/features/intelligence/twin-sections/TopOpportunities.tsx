"use client";

/**
 * Section 6 — Top Opportunities.
 * Maximum 3, sorted by (priority weight, estimated_value desc).
 * Each shows Opportunity + Why it matters + Potential impact +
 * Required effort + Time horizon.
 *
 * Source: `intelligence.opportunities.opportunities[]`.
 * Scenario language only ("Potential path to …", "Could
 * enable …", "May unlock …"). NEVER guarantee outcomes.
 *
 * Empty list → "No opportunities detected" placeholder.
 */

import React from "react";
import type { IntelligenceResponse } from "@/types/dashboard";
import type { OpportunityItem } from "@/types/intelligence";
import { InsightChip } from "@/components/intelligence/InsightChip";

interface TopOpportunitiesProps {
  intelligence?: IntelligenceResponse | null;
}

const PRIORITY_RANK: Record<OpportunityItem["priority"], number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const IMPACT_RANK: Record<OpportunityItem["impact"], number> = {
  High: 0,
  Medium: 1,
  Low: 2,
};

function pick(opps: OpportunityItem[] | undefined, max = 3): OpportunityItem[] {
  if (!opps || opps.length === 0) return [];
  return [...opps]
    .sort((a, b) => {
      const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (r !== 0) return r;
      const i = (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9);
      if (i !== 0) return i;
      return b.estimated_value - a.estimated_value;
    })
    .slice(0, max);
}

function horizonLabel(category: string | null | undefined, difficulty: string): string {
  // Use category + difficulty to give a *qualitative* horizon
  // label. We do not fabricate numeric durations.
  const c = (category || "").toLowerCase();
  if (c.includes("export")) return "12+ months";
  if (c.includes("digital")) return difficulty === "Easy" ? "1–3 months" : "3–6 months";
  if (c.includes("funding") || c.includes("loan")) return "1–3 months";
  return "3–6 months";
}

/**
 * P0.7 — Currency is no longer forced to USD. We derive the symbol
 * from the payload's currency when present, and otherwise render a
 * neutral label so the user is never silently assumed to operate in
 * USD.
 */
function formatScenario(value: number, currency: string | null): string {
  if (!value || value <= 0) return "Potential value not yet quantified";
  if (!currency) {
    return `Potential path to ${value.toLocaleString()} (currency unspecified) — scenario estimate`;
  }
  const symbol = currency === "USD" ? "$" : currency === "INR" ? "₹" : "";
  return `Potential path to ${symbol}${value.toLocaleString()} ${currency} if executed — scenario estimate`;
}

export const TopOpportunities: React.FC<TopOpportunitiesProps> = ({ intelligence }) => {
  if (!intelligence) return null;
  const report = intelligence.opportunities;
  const items = pick(report?.opportunities);
  const currency = report?.currency ?? null;

  return (
    <section
      aria-labelledby="twin-section-opportunities"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Section 6
        </span>
        <h2 id="twin-section-opportunities" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
          Top Opportunities
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length === 0
            ? "What could unlock growth next."
            : `Showing ${items.length} of ${report?.total_count ?? items.length} detected opportunities. Estimates are scenario, not promise.`}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-xs italic text-muted-foreground">
          No opportunities detected yet — they will appear here as your profile matures.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-card-foreground">{o.title}</h3>
                <InsightChip
                  label={`Priority: ${o.priority}`}
                  variant={o.priority === "Critical" || o.priority === "High" ? "high" : o.priority === "Medium" ? "medium" : "low"}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Why it matters:</span> {o.description}
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Potential impact</dt>
                  <dd className="font-semibold text-card-foreground">
                    {formatScenario(o.estimated_value, currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Required effort</dt>
                  <dd className="font-semibold text-card-foreground">{o.difficulty}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Time horizon</dt>
                  <dd className="font-semibold text-card-foreground">
                    {horizonLabel(o.category, o.difficulty)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
