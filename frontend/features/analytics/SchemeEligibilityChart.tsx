"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Landmark, CheckCircle2 } from "lucide-react";

export function SchemeEligibilityChart() {
  const schemes = [
    { name: "PMEGP (Prime Minister's Employment Generation)", match: 95, subsidy: "35% Subsidy" },
    { name: "CGTMSE (Credit Guarantee Fund Scheme)", match: 88, subsidy: "Collateral-Free ₹5 Cr" },
    { name: "MUDRA Loan (Shishu / Kishore / Tarun)", match: 81, subsidy: "Subsidized Interest" },
    { name: "Startup India & Tax Exemption", match: 74, subsidy: "Tax Holiday & Incubator" },
  ];

  return (
    <DashboardCard
      badge="Scheme Matching"
      title="Government Scheme Match %"
      caption="Automated capital subsidy match confidence calculated from your business profile parameters."
    >
      <div className="flex flex-col gap-3.5">
        {schemes.map((s) => (
          <div key={s.name} className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground truncate flex items-center gap-1.5">
                <Landmark className="size-3.5 text-teal-500 shrink-0" />
                {s.name}
              </span>
              <span className="font-extrabold text-teal-500 shrink-0 bg-teal-500/10 px-2 py-0.5 rounded-full">
                {s.match}% Match
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-primary rounded-full transition-all duration-500"
                style={{ width: `${s.match}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{s.subsidy}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
