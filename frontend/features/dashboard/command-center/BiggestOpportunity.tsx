"use client";

/**
 * H5.2 — Section 6: Biggest Opportunity.
 *
 * The single strongest current opportunity. Uses
 * intelligence.opportunities.opportunities[] sorted by priority
 * + impact + estimated_value.
 *
 * Every numeric value is a scenario estimate — explicitly labelled.
 * No guaranteed-revenue claims.
 */

import React from "react";
import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import type { OpportunityItem } from "@/types/intelligence";

interface BiggestOpportunityProps {
  opportunities: OpportunityItem[];
}

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
const IMPACT_RANK = { High: 0, Medium: 1, Low: 2 } as const;

function pickTop(opps: OpportunityItem[]): OpportunityItem | null {
  if (!opps || opps.length === 0) return null;
  return [...opps]
    .sort((a, b) => {
      const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (r !== 0) return r;
      const i = (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9);
      if (i !== 0) return i;
      return b.estimated_value - a.estimated_value;
    })[0] || null;
}

export const BiggestOpportunity: React.FC<BiggestOpportunityProps> = ({ opportunities }) => {
  const top = pickTop(opportunities);

  if (!top) {
    return (
      <DashboardCard
        badge="Biggest Opportunity"
        title="No active opportunity identified"
        caption="Complete your business profile to surface growth paths."
        data-testid="command-center-opportunity"
      >
        <p className="text-sm text-muted-foreground">
          The rule engine did not surface any opportunities. Try expanding your business profile.
        </p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      badge="Biggest Opportunity"
      title="The strongest current opportunity"
      caption="Scenario estimate. Not a guarantee."
      className="border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06]"
      data-testid="command-center-opportunity"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-foreground">{top.title}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {top.priority}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{top.description || top.category}</p>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-background p-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Why it matters</span>
            <span className="block text-foreground">
              {top.impact === "High" ? "High-impact path forward." : "Realistic growth path."}
            </span>
          </div>
          <div className="rounded-md border border-border/60 bg-background p-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Potential impact</span>
            <span className="block text-foreground">
              {top.estimated_value > 0 ? `$${top.estimated_value.toLocaleString()} (scenario)` : "Potential value not yet quantified"}
            </span>
          </div>
          <div className="rounded-md border border-border/60 bg-background p-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Effort / horizon</span>
            <span className="block text-foreground">
              {top.difficulty || "—"} · {top.category || "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2 text-xs">
            <Link href={`/assistant?prompt=${encodeURIComponent(`Help me plan: ${top.title}`)}`}>
              <TrendingUp className="size-3.5" aria-hidden="true" />
              Ask AI to plan this
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2 text-xs">
            <Link href="/intelligence">View all opportunities →</Link>
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
};
