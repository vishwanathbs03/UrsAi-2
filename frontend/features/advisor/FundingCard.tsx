"use client";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { FundingReport } from "@/types/advisor";
import { Building, CheckCircle2, DollarSign, HelpCircle } from "lucide-react";

interface FundingCardProps {
  report: FundingReport;
}

export function FundingCard({ report }: FundingCardProps) {
  return (
    <DashboardCard
      badge="Capital & Funding"
      title="Funding Readiness & Government MSME Schemes"
      caption="Evaluated bank loan readiness, equity investor appeal, and applicable government subsidy schemes."
      data-testid="funding-card"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreTile label="Loan Readiness" score={report.loan_readiness_score} />
        <ScoreTile label="Investor Readiness" score={report.investor_readiness_score} />
        <ScoreTile label="Grant Eligibility" score={report.grant_eligibility_score} />
      </div>

      {!report.profile_complete && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <HelpCircle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            Some scores show <span className="font-semibold text-foreground/90">Not yet assessed</span> —
            complete your business profile to surface the full funding picture.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recommended MSME Government Schemes
        </span>
        <div className="flex flex-wrap gap-2">
          {report.msme_schemes.map((scheme, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <Building className="size-3.5" />
              {scheme}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Funding Action Checklist
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {report.funding_checklist.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs"
            >
              <span className="text-foreground">{item.task}</span>
              {item.completed ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3.5" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                  <HelpCircle className="size-3.5" /> Pending
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function ScoreTile({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 p-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <DollarSign className="size-4 text-emerald-500" />
        <AnimatedCounter
          value={score}
          className="text-xl font-bold text-foreground"
          durationMs={500}
        />
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}
