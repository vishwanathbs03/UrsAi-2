import React from "react";
import type { OpportunityReport } from "@/types/intelligence";
import { InsightChip } from "./InsightChip";

interface OpportunityCardProps {
  report?: OpportunityReport;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ report }) => {
  if (!report || report.opportunities.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-card-foreground">Growth & Expansion Opportunities</h3>
          <p className="text-sm text-muted-foreground">
            Detected {report.total_count} strategic opportunities with estimated total value of{" "}
            <span className="font-bold text-emerald-500">${report.total_estimated_value.toLocaleString()} USD</span>.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {report.opportunities.map((opp) => (
          <div
            key={opp.id}
            className="rounded-lg border border-border/50 bg-muted/20 p-4 transition-all hover:border-emerald-500/30 hover:bg-muted/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-base font-bold text-card-foreground">{opp.title}</h4>
              <div className="flex items-center gap-2">
                <InsightChip label={`Priority: ${opp.priority}`} variant={opp.priority.toLowerCase() === "high" ? "high" : opp.priority.toLowerCase() === "medium" ? "medium" : "low"} />
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  +${opp.estimated_value.toLocaleString()} USD
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{opp.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Category: <strong className="text-card-foreground capitalize">{opp.category}</strong></span>
              <span>Impact: <strong className="text-card-foreground">{opp.impact}</strong></span>
              <span>Difficulty: <strong className="text-card-foreground">{opp.difficulty}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
