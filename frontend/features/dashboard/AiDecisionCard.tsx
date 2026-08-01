"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "./LevelBadge";
import { levelToTone } from "./tones";
import { cn } from "@/lib/utils";
import type { AIDecisionBody } from "@/types/dashboard";

interface AiDecisionCardProps {
  decision: AIDecisionBody;
  model: string;
}

/**
 * AI Decision Summary — the top 3-5 insights from the
 * (currently mocked) AI Decision engine. Insights are
 * collapsible so the card stays scannable.
 */
export function AiDecisionCard({ decision, model }: AiDecisionCardProps) {
  const insights = decision.insights;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? insights : insights.slice(0, 3);

  return (
    <DashboardCard
      badge="AI Decision"
      title={decision.overall_health}
      caption={`${decision.archetype_label} — model: ${model}`}
      trailing={
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="size-3" aria-hidden="true" />
          {insights.length} insight{insights.length === 1 ? "" : "s"}
        </span>
      }
    >
      <p className="text-sm leading-relaxed text-foreground">{decision.summary}</p>

      {(decision.top_strengths.length > 0 || decision.top_risks.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {decision.top_strengths.length > 0 && (
            <div className="rounded-lg border border-border bg-emerald-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Top strengths
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                {decision.top_strengths.map((s) => (
                  <li key={s} className="leading-snug">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decision.top_risks.length > 0 && (
            <div className="rounded-lg border border-border bg-rose-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                Top risks
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-xs text-foreground">
                {decision.top_risks.map((r) => (
                  <li key={r} className="leading-snug">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No insights — the engine has nothing decision-worthy to highlight.
          </p>
        ) : (
          visible.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{i.title}</p>
                <div className="flex items-center gap-1">
                  <LevelBadge
                    level={i.priority}
                    tone={levelToTone(
                      i.priority === "Critical" || i.priority === "High"
                        ? "low"
                        : i.priority === "Medium"
                        ? "medium"
                        : "high",
                    )}
                  />
                  <LevelBadge
                    level={`${i.confidence}%`}
                    tone={levelToTone(i.confidence >= 70 ? "high" : i.confidence >= 40 ? "medium" : "low")}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {i.explanation}
              </p>
              {i.supporting_rule_ids.length > 0 && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {i.supporting_rule_ids.join(" · ")}
                </p>
              )}
            </div>
          ))
        )}
        {insights.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={cn(
              "inline-flex w-fit items-center gap-1 self-end rounded-md px-2 py-1 text-xs font-medium",
              "text-primary hover:bg-secondary",
            )}
          >
            {showAll ? "Show less" : `Show all (${insights.length})`}
            {showAll ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </DashboardCard>
  );
}
