"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "./LevelBadge";
import { levelToTone } from "./tones";
import { cn } from "@/lib/utils";
import type { DnaFinding } from "@/types/dashboard";

interface SwotSummaryCardProps {
  strengths: DnaFinding[];
  weaknesses: DnaFinding[];
  opportunities: DnaFinding[];
  risks: DnaFinding[];
}

type Quad = "strengths" | "weaknesses" | "opportunities" | "risks";

const QUADS: { key: Quad; title: string; tone: string; empty: string }[] = [
  {
    key: "strengths",
    title: "Strengths",
    tone: "text-emerald-700",
    empty: "No strengths recorded yet — fill more profile data to surface them.",
  },
  {
    key: "weaknesses",
    title: "Weaknesses",
    tone: "text-rose-700",
    empty: "No weaknesses recorded yet — the DNA engine sees no critical gaps.",
  },
  {
    key: "opportunities",
    title: "Opportunities",
    tone: "text-sky-700",
    empty: "No opportunities surfaced — add goals and exports to unlock them.",
  },
  {
    key: "risks",
    title: "Risk Areas",
    tone: "text-amber-700",
    empty: "No risk areas flagged — well done on the risk posture.",
  },
];

/**
 * SWOT Summary — a 2x2 grid of the four DNA SWOT quadrants.
 * Each quadrant is collapsible so the card stays compact.
 */
export function SwotSummaryCard({
  strengths,
  weaknesses,
  opportunities,
  risks,
}: SwotSummaryCardProps) {
  const map: Record<Quad, DnaFinding[]> = {
    strengths,
    weaknesses,
    opportunities,
    risks,
  };

  return (
    <DashboardCard
      badge="SWOT"
      title="SWOT Summary"
      caption="The four SWOT quadrants produced by the DNA engine. Expand a quadrant to see the underlying findings."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUADS.map((q) => (
          <SwotQuadrant
            key={q.key}
            title={q.title}
            tone={q.tone}
            empty={q.empty}
            items={map[q.key]}
          />
        ))}
      </div>
    </DashboardCard>
  );
}

function SwotQuadrant({
  title,
  tone,
  empty,
  items,
}: {
  title: string;
  tone: string;
  empty: string;
  items: DnaFinding[];
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? items : items.slice(0, 3);

  return (
    <div className="rounded-lg border border-border bg-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className={cn("text-sm font-semibold", tone)}>{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{items.length}</span>
          {items.length > 3 &&
            (open ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            ))}
        </span>
      </button>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          visible.map((it) => (
            <div
              key={it.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5"
            >
              <p className="text-xs font-medium leading-snug text-foreground">{it.title}</p>
              <LevelBadge
                level={it.severity}
                tone={levelToTone(
                  it.severity === "high"
                    ? "low"
                    : it.severity === "medium"
                    ? "medium"
                    : it.severity === "low"
                    ? "high"
                    : "low",
                )}
              />
            </div>
          ))
        )}
        {!open && items.length > 3 && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Showing 3 of {items.length} — click to expand
          </p>
        )}
      </div>
    </div>
  );
}
