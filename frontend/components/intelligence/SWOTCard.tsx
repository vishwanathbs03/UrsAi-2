import React from "react";
import type { SWOTReport, SWOTItem } from "@/types/intelligence";

interface SWOTCardProps {
  swot?: SWOTReport;
}

export const SWOTCard: React.FC<SWOTCardProps> = ({ swot }) => {
  if (!swot) return null;

  const sections: { title: string; items: SWOTItem[]; border: string; bg: string; badgeBg: string; text: string }[] = [
    {
      title: "Strengths",
      items: swot.strengths || [],
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5 dark:bg-emerald-500/10",
      badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "Weaknesses",
      items: swot.weaknesses || [],
      border: "border-amber-500/30",
      bg: "bg-amber-500/5 dark:bg-amber-500/10",
      badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      text: "text-amber-700 dark:text-amber-300",
    },
    {
      title: "Opportunities",
      items: swot.opportunities || [],
      border: "border-cyan-500/30",
      bg: "bg-cyan-500/5 dark:bg-cyan-500/10",
      badgeBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      text: "text-cyan-700 dark:text-cyan-300",
    },
    {
      title: "Threats",
      items: swot.threats || [],
      border: "border-rose-500/30",
      bg: "bg-rose-500/5 dark:bg-rose-500/10",
      badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      text: "text-rose-700 dark:text-rose-300",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-card-foreground">SWOT Matrix Analysis</h3>
        <p className="text-sm text-muted-foreground">Strategic overview of internal and external factors.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((sec) => (
          <div key={sec.title} className={`rounded-lg border ${sec.border} ${sec.bg} p-4`}>
            <h4 className={`text-base font-bold ${sec.text} mb-3 flex items-center justify-between`}>
              <span>{sec.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sec.badgeBg}`}>
                {sec.items.length} items
              </span>
            </h4>
            <div className="space-y-2.5">
              {sec.items.map((item, idx) => (
                <div key={idx} className="rounded-md border border-border/40 bg-card/80 p-2.5 shadow-2xs">
                  <div className="font-semibold text-card-foreground text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                </div>
              ))}
              {sec.items.length === 0 && (
                <div className="text-xs text-muted-foreground italic">No factors identified.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
