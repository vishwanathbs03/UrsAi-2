"use client";

/**
 * Section 5 — Top Risks.
 * Maximum 3, sorted by impact (high → medium → low). Each
 * shows Risk + Severity + Why it matters + Recommended
 * mitigation. Source = swot.threats from the intelligence
 * payload.
 *
 * If the user has explicitly stated a concern in the current
 * assistant session (we read the assistant's localStorage
 * memory key) and it is still relevant, surface it as a
 * separate labelled slot ABOVE the system risks, clearly
 * marked as user-reported.
 *
 * Empty threats + no user concern → "No critical risks
 * detected" placeholder. No fabrication.
 */

import React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { IntelligenceResponse } from "@/types/dashboard";
import type { SWOTItem } from "@/types/intelligence";
import { InsightChip } from "@/components/intelligence/InsightChip";

interface TopRisksProps {
  intelligence?: IntelligenceResponse | null;
}

const IMPACT_RANK: Record<SWOTItem["impact"], number> = { high: 0, medium: 1, low: 2 };

interface UserConcern {
  text: string;
  source?: string;
}

function readUserConcernFromSession(): UserConcern | null {
  if (typeof window === "undefined") return null;
  try {
    // Sprint 4.2 P1.4 stored user-stated concerns under this key
    // (see features/assistant/memory.ts). We read defensively
    // because the schema may evolve.
    const raw =
      window.localStorage.getItem("ursbiz.assistant.userConcern") ||
      window.localStorage.getItem("ursbiz.assistant.lastUserConcern");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserConcern>;
    if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
      return { text: parsed.text, source: parsed.source };
    }
    return null;
  } catch (_) {
    return null;
  }
}

function pick(threats: SWOTItem[] | undefined, max = 3): SWOTItem[] {
  if (!threats || threats.length === 0) return [];
  return [...threats]
    .sort((a, b) => (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9))
    .slice(0, max);
}

export const TopRisks: React.FC<TopRisksProps> = ({ intelligence }) => {
  const [concern, setConcern] = useState<UserConcern | null>(null);

  useEffect(() => {
    setConcern(readUserConcernFromSession());
  }, []);

  if (!intelligence) return null;
  const items = pick(intelligence.swot?.threats);

  return (
    <section
      aria-labelledby="twin-section-risks"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Section 5
          </span>
          <h2 id="twin-section-risks" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
            Top Risks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">What could derail your progress.</p>
        </div>
      </header>

      {concern && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2">
            <InsightChip label="User-stated concern" variant="critical" />
            <span className="text-[11px] text-muted-foreground">
              From your assistant conversation
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-card-foreground">&ldquo;{concern.text}&rdquo;</p>
          <Link
            href="/assistant"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
          >
            Revisit in assistant →
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-xs italic text-muted-foreground">
          No critical risks detected.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((r, idx) => {
            const sev = r.impact === "high" ? "Critical" : r.impact === "medium" ? "Medium" : "Low";
            return (
              <li
                key={`${r.title}-${idx}`}
                className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-card-foreground">{r.title}</h3>
                  <InsightChip label={`Severity: ${sev}`} variant={r.impact === "high" ? "critical" : r.impact === "medium" ? "medium" : "low"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-semibold">Why it matters:</span> {r.description}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold">Recommended mitigation:</span>{" "}
                  Address the underlying <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{r.category}</code>{" "}
                  factor through your top-ranked recommendation in Section 7.
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
