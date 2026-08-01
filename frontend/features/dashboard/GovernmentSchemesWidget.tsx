"use client";

import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, ExternalLink, Landmark, Sparkles } from "lucide-react";

export function GovernmentSchemesWidget() {
  const topSchemes = [
    {
      name: "PMEGP (Prime Minister's Employment Generation)",
      subsidy: "Up to 35% Capital Subsidy",
      match: "95% Match",
      status: "Eligible",
      category: "Capital Grant",
    },
    {
      name: "CGTMSE (Credit Guarantee Fund Scheme)",
      subsidy: "Collateral-Free Loan up to ₹5 Cr",
      match: "92% Match",
      status: "Eligible",
      category: "Credit Guarantee",
    },
    {
      name: "MUDRA Loan (Shishu / Kishore / Tarun)",
      subsidy: "Subsidized Interest Rate up to ₹10 Lakhs",
      match: "88% Match",
      status: "Eligible",
      category: "Working Capital",
    },
  ];

  return (
    <DashboardCard
      badge="Opportunity Engine"
      title="Eligible Government Schemes & Subsidies"
      caption="Central & State MSME schemes matched automatically to your business profile."
      trailing={
        <Button asChild size="sm" variant="outline" className="gap-1 text-xs">
          <Link href="/schemes">
            View All Schemes
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {topSchemes.map((scheme, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-xs shadow-xs hover-lift transition-all hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-500">
                  <Landmark className="size-4" />
                </div>
                <span className="font-bold text-foreground line-clamp-1">{scheme.name}</span>
              </div>
              <span className="shrink-0 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-extrabold text-teal-500">
                {scheme.match}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="size-3" />
                {scheme.subsidy}
              </span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
                {scheme.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
