"use client";

/**
 * H5.2 — Section 4: Today's Top 3 Priorities.
 * Exactly 3 prioritized actions, sorted by priority + score gain.
 * Each action has Why now / Expected benefit / Difficulty / Time
 * required + a CTA. CTAs use existing routes — never invent new ones.
 */

import React from "react";
import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  Landmark,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { RecommendationItem } from "@/types/analytics";

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

interface TopPrioritiesProps {
  recommendations: RecommendationItem[];
  businessExists: boolean;
  hasWeakestDimension: boolean;
}

function buildCta(rec: RecommendationItem, businessExists: boolean): {
  label: string;
  href: string;
  icon: React.ReactNode;
} {
  // CTA chosen deterministically based on category / phase — we
  // do NOT invent new routes. Existing routes are
  //   /assistant?prompt=...
  //   /analytics
  //   /schemes
  //   /business
  //   /reports
  //   /intelligence
  const phase = (rec.phase || "").toLowerCase();
  if (!businessExists) {
    return { label: "Update Profile", href: "/business", icon: <Building2 className="size-3.5" aria-hidden="true" /> };
  }
  if (phase.includes("digital") || phase.includes("marketing")) {
    return { label: "Open Analytics", href: "/analytics", icon: <BarChart3 className="size-3.5" aria-hidden="true" /> };
  }
  if (phase.includes("export") || phase.includes("scheme") || phase.includes("funding")) {
    return { label: "View Scheme", href: "/schemes", icon: <Landmark className="size-3.5" aria-hidden="true" /> };
  }
  if (phase.includes("compliance") || phase.includes("legal")) {
    return { label: "Generate Report", href: "/reports", icon: <FileText className="size-3.5" aria-hidden="true" /> };
  }
  if (rec.priority === "Critical") {
    const q = `Build me a 30-day action plan for: ${rec.title}`;
    return { label: "Ask AI for a plan", href: `/assistant?prompt=${encodeURIComponent(q)}`, icon: <MessageSquare className="size-3.5" aria-hidden="true" /> };
  }
  return { label: "Ask AI for a plan", href: `/assistant?prompt=${encodeURIComponent("Create a 30-day action plan for: " + rec.title)}`, icon: <MessageSquare className="size-3.5" aria-hidden="true" /> };
}

export const TopPriorities: React.FC<TopPrioritiesProps> = ({ recommendations, businessExists, hasWeakestDimension }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <DashboardCard
        badge="Today's Priorities"
        title="Top 3 priorities for today"
        caption="Three prioritized actions, ranked by impact."
        data-testid="command-center-priorities"
      >
        <p className="text-sm text-muted-foreground">
          {hasWeakestDimension
            ? "No priority actions are queued yet. Address your weakest dimension to surface one."
            : "No priority actions are queued yet."}
        </p>
      </DashboardCard>
    );
  }

  const top3 = [...recommendations]
    .sort((a, b) => {
      const r = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (r !== 0) return r;
      return (b.estimated_score_gain || 0) - (a.estimated_score_gain || 0);
    })
    .slice(0, 3);

  return (
    <DashboardCard
      badge="Today's Priorities"
      title="Top 3 priorities for today"
      caption="Three prioritized actions, ranked by impact. Each opens existing UrsBiz functionality."
      data-testid="command-center-priorities"
    >
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {top3.map((rec, idx) => {
          const cta = buildCta(rec, businessExists);
          const gain = rec.estimated_score_gain > 0 ? `+${rec.estimated_score_gain} points (scenario)` : "";
          return (
            <li
              key={rec.id || idx}
              className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              data-testid={`priority-${idx + 1}`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Priority {idx + 1}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{rec.priority}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">{rec.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rec.description || rec.category || ""}</p>
              <dl className="mt-1 grid grid-cols-2 gap-y-1.5 text-[11px] text-muted-foreground">
                <dt className="font-semibold">Why now</dt>
                <dd className="text-foreground">
                  {rec.priority === "Critical" || rec.priority === "High"
                    ? `High priority and aligned with your weakest dimension.`
                    : `Aligned with an actionable dimension in your profile.`}
                </dd>
                <dt className="font-semibold">Impact</dt>
                <dd className="text-foreground">{gain || "Modelled score contribution: see recommendation"}</dd>
                <dt className="font-semibold">Difficulty</dt>
                <dd className="text-foreground">{rec.difficulty || "—"}</dd>
                <dt className="font-semibold">Time</dt>
                <dd className="text-foreground">{rec.estimated_timeline || "—"}</dd>
              </dl>
              <div className="mt-auto pt-2">
                <Button asChild size="sm" variant="outline" className="w-full justify-between gap-2 text-xs">
                  <Link href={cta.href}>
                    <span className="inline-flex items-center gap-1.5">
                      {cta.icon}
                      {cta.label}
                    </span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </DashboardCard>
  );
};
