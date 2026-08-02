"use client";

/**
 * H5.2 — Section 5: Biggest Risk.
 *
 * The single most important current risk. If the user has
 * explicitly stated a concern in the assistant's localStorage
 * session and it matches an existing risk, it elevates that
 * risk's priority.
 *
 * No fabricated risk values — every label comes from
 * twin.risk_matrix OR intelligence.swot.threats.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, UserCircle2, ArrowRight } from "lucide-react";
import type { TwinResponse, TwinRiskEntry } from "@/types/analytics";

interface BiggestRiskProps {
  twin?: TwinResponse | null;
}

const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

function pickTopRisk(twin: TwinResponse | null | undefined): TwinRiskEntry | null {
  if (!twin) return null;
  const matrix = [
    ...(twin.risk_matrix?.critical_risks || []),
    ...(twin.risk_matrix?.high_risks || []),
    ...(twin.risk_matrix?.medium_risks || []),
  ];
  // The risk_matrix buckets are pre-sorted by severity (critical
  // first). Take the first entry across all buckets.
  return matrix[0] || null;
}

function readUserConcern(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ursbiz.assistant.userConcern");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
      return parsed.text.trim();
    }
    if (typeof parsed === "string" && parsed.trim().length > 0) return parsed.trim();
  } catch (_) {}
  return null;
}

function matches(text: string, q: string): boolean {
  if (!q) return false;
  const t = text.toLowerCase();
  // Tokenize both sides and require ≥ 1 shared word of length ≥ 4.
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return words.some((w) => t.includes(w));
}

export const BiggestRisk: React.FC<BiggestRiskProps> = ({ twin }) => {
  // The user-stated concern slot requires `useEffect` to read
  // localStorage after mount. Server-render gives null; client
  // mount upgrades the priority if relevant.
  const [userConcern, setUserConcern] = useState<string | null>(null);
  useEffect(() => { setUserConcern(readUserConcern()); }, []);

  const picked = pickTopRisk(twin);
  // If user concern matches a risk better than the auto-top, promote that one.
  let chosen: TwinRiskEntry | null = picked;
  if (userConcern && twin) {
    const all = [
      ...(twin.risk_matrix?.critical_risks || []),
      ...(twin.risk_matrix?.high_risks || []),
      ...(twin.risk_matrix?.medium_risks || []),
    ];
    const matched = all.find((r) => matches(r.title + " " + (r.description || ""), userConcern));
    if (matched && (!chosen || matched.priority === "Critical")) {
      chosen = matched;
    }
  }

  if (!chosen) {
    return (
      <DashboardCard
        badge="Biggest Risk"
        title="No active risk identified"
        caption="Your rule engine did not surface any risks. Stay vigilant."
        data-testid="command-center-risk"
      >
        <p className="text-sm text-muted-foreground">
          No risks are currently flagged for your business. Complete your profile to enable risk analysis.
        </p>
      </DashboardCard>
    );
  }

  const isUserConcern = userConcern && matches(chosen.title + " " + (chosen.description || ""), userConcern);

  return (
    <DashboardCard
      badge="Biggest Risk"
      title="The most important risk right now"
      caption="Deterministic. No fabrication."
      className="border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/[0.06]"
      data-testid="command-center-risk"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-foreground">{chosen.title}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            {chosen.priority || "High"}
          </span>
        </div>
        {chosen.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{chosen.description}</p>
        )}
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-background p-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Why it matters</span>
            <span className="block text-foreground">{chosen.description || "It can derail your operations or score if not addressed."}</span>
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Mitigation</span>
            <span className="block text-foreground">
              Address this risk by improving the underlying rule. Ask the AI Assistant for a tailored mitigation plan.
            </span>
          </div>
        </div>
        {isUserConcern && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <UserCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>Elevated by your stated concern: <em>"{userConcern}"</em></span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2 text-xs">
            <Link href={`/assistant?prompt=${encodeURIComponent(`My top risk is ${chosen.title.toLowerCase()}. How should I mitigate it?`)}`}>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Ask AI for a mitigation plan
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2 text-xs">
            <Link href="/intelligence">
              View all risks →
            </Link>
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
};
