"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Clock } from "lucide-react";

interface RecentAnalysisCardProps {
  intelligenceAt: string | null;
  scoresAt: string | null;
  dnaAt: string | null;
  rulesAt: string | null;
  decisionAt: string | null;
}

/**
 * Recent analysis timestamp card — shows the freshness of
 * every upstream payload the dashboard consumes. Useful for
 * the user to know when the next analysis ran.
 */
export function RecentAnalysisCard({
  intelligenceAt,
  scoresAt,
  dnaAt,
  rulesAt,
  decisionAt,
}: RecentAnalysisCardProps) {
  const rows: { label: string; at: string | null }[] = [
    { label: "Intelligence", at: intelligenceAt },
    { label: "Scores", at: scoresAt },
    { label: "DNA", at: dnaAt },
    { label: "Rules", at: rulesAt },
    { label: "Decision", at: decisionAt },
  ];

  return (
    <DashboardCard
      badge="Recency"
      title="Recent Analysis"
      caption="When each upstream payload was last computed."
      compact
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2"
          >
            <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
              <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {r.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {r.at ? formatRel(r.at) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

function formatRel(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Math.max(0, Date.now() - then);
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
  } catch {
    return iso;
  }
}
