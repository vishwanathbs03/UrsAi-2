"use client";

import { useState } from "react";
import { ChevronRight, FileText, Lightbulb, ListChecks, Map } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import {
  confidenceToTone,
  levelToTone,
} from "@/features/dashboard/tones";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { cn } from "@/lib/utils";
import { INSIGHT_CATEGORIES } from "./use-insights-filters";
import type { InsightItem } from "./use-insights-data";

interface InsightCardProps {
  insight: InsightItem;
  onOpen: (insight: InsightItem) => void;
}

/**
 * One insight card. Surfaces every field the spec named
 * (title, summary, confidence, priority, supporting rules,
 * supporting knowledge, related recommendation, related
 * roadmap) using the existing card / badge / level-tone
 * primitives. Click anywhere on the card body to open
 * the detail slide-over.
 */
export function InsightCard({ insight, onOpen }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const relatedRec = insight.relatedRecommendations[0];
  const relatedRoadmap = insight.relatedRoadmapItems[0];
  const categoryLabel =
    INSIGHT_CATEGORIES.find((c) => c.key === insight.category)?.label ??
    insight.rawCategory;
  const conf = confidenceToTone(insight.confidence);
  const prioTone = levelToTone(insight.priority);

  return (
    <DashboardCard
      badge={categoryLabel}
      title={insight.title}
      compact
      trailing={
        <div className="flex items-center gap-1.5">
          <LevelBadge
            level={insight.priority}
            tone={prioTone}
          />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              conf.tone,
            )}
            aria-label={`Confidence: ${conf.label} (${Math.round(insight.confidence)}%)`}
          >
            <AnimatedCounter
              value={Math.round(insight.confidence)}
              suffix="%"
              className="normal-case tracking-normal"
              durationMs={500}
            />
            {conf.label}
          </span>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => onOpen(insight)}
        className="block w-full text-left text-sm leading-relaxed text-foreground"
      >
        {insight.explanation}
      </button>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Evidence
          icon={<ListChecks className="size-3.5" aria-hidden="true" />}
          label="Supporting rules"
          count={insight.supportingRules.length}
          ids={insight.supportingRuleIds}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
        <Evidence
          icon={<FileText className="size-3.5" aria-hidden="true" />}
          label="Supporting knowledge"
          count={insight.supportingArticleIds.length}
          ids={insight.supportingArticleIds}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      </div>

      {(relatedRec || relatedRoadmap) && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
          {relatedRec && (
            <div className="flex items-start gap-2">
              <Lightbulb
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Related recommendation
                </span>
                <span className="truncate text-foreground">
                  {relatedRec.title}
                </span>
              </div>
            </div>
          )}
          {relatedRoadmap && (
            <div className="flex items-start gap-2">
              <Map
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Related roadmap item
                </span>
                <span className="truncate text-foreground">
                  {relatedRoadmap.title}{" "}
                  <span className="text-muted-foreground">
                    ({relatedRoadmap.phase})
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {insight.supportingRules.length} rule
          {insight.supportingRules.length === 1 ? "" : "s"} ·{" "}
          {insight.relatedRecommendations.length} recommendation
          {insight.relatedRecommendations.length === 1 ? "" : "s"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpen(insight)}
          aria-label={`View detail for ${insight.title}`}
        >
          View detail
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </DashboardCard>
  );
}

interface EvidenceProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  ids: string[];
  expanded: boolean;
  onToggle: () => void;
}

function Evidence({ icon, label, count, ids, expanded }: EvidenceProps) {
  const visible = expanded ? ids : ids.slice(0, 2);
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs">
      <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {count}
        </span>
      </span>
      {visible.length === 0 ? (
        <span className="text-muted-foreground">None linked.</span>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visible.map((id) => (
            <li key={id} className="font-mono text-[10px] text-foreground/80">
              {id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
