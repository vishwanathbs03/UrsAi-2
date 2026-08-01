import React from "react";
import type { DNAPayload } from "@/types/intelligence";
import { InsightChip } from "./InsightChip";

interface BusinessDNACardProps {
  dna?: DNAPayload;
}

export const BusinessDNACard: React.FC<BusinessDNACardProps> = ({ dna }) => {
  const data = dna?.business_dna;
  const archetype = dna?.archetype;

  if (!data && !archetype) {
    return null;
  }

  const traits = [
    { label: "Business Stage", value: data?.business_stage || "Established" },
    { label: "Digital Maturity", value: data?.digital_maturity || "High" },
    { label: "Operational Complexity", value: data?.operational_complexity || "Medium" },
    { label: "Growth Potential", value: data?.growth_potential || "High" },
    { label: "Market Position", value: data?.market_position || "Regional Leader" },
    { label: "Automation Level", value: data?.automation_level || "Semi-Automated" },
    { label: "Risk Profile", value: data?.risk_profile || "Low" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Business Classification
          </span>
          <h3 className="text-xl font-bold text-card-foreground">
            {data?.overall_dna || archetype?.title || "Digital Native"}
          </h3>
        </div>
        <InsightChip label="Primary DNA" variant="high" />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {archetype?.description || "Deterministic DNA profile derived from business operations and digital maturity."}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {traits.map((t, idx) => (
          <div key={idx} className="rounded-lg border border-border/40 bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <div className="mt-1 font-semibold text-card-foreground">{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
