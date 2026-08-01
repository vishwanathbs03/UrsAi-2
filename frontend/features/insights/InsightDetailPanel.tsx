"use client";

import { ListChecks, FileText, Lightbulb, Map, Sparkles, Target, TriangleAlert } from "lucide-react";
import { SlideOver } from "@/components/common/SlideOver";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { confidenceToTone, levelToTone } from "@/features/dashboard/tones";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { INSIGHT_CATEGORIES } from "./use-insights-filters";
import type { InsightItem } from "./use-insights-data";

interface InsightDetailPanelProps {
  insight: InsightItem | null;
  onClose: () => void;
}

/**
 * Slide-over detail panel for a single insight. Reuses the
 * existing SlideOver primitive (no new dep). Shows the
 * full explanation, supporting evidence, related
 * recommendations, and related roadmap items.
 */
export function InsightDetailPanel({ insight, onClose }: InsightDetailPanelProps) {
  const open = insight !== null;
  const conf = insight ? confidenceToTone(insight.confidence) : null;
  const categoryLabel = insight
    ? INSIGHT_CATEGORIES.find((c) => c.key === insight.category)?.label ??
      insight.rawCategory
    : "";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={insight?.title ?? "Insight detail"}
      description={insight ? `${categoryLabel} · ${insight.priority} priority` : ""}
      width={480}
    >
      {insight && conf && (
        <div className="flex flex-col gap-4">
          <section
            aria-label="Overview"
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelBadge
                level={insight.priority}
                tone={levelToTone(insight.priority)}
              />
              <span
                className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${conf.tone}`}
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
            <p className="text-sm leading-relaxed text-foreground">
              {insight.explanation}
            </p>
          </section>

          <section aria-label="Supporting evidence" className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Supporting evidence
            </p>
            <EvidenceBlock
              icon={<ListChecks className="size-3.5" aria-hidden="true" />}
              label="Rule firings"
              items={insight.supportingRules.map((r) => ({
                id: r.id,
                primary: r.title,
                secondary: `${r.priority} · ${r.category}`,
              }))}
              emptyText="No rule firings linked to this insight."
            />
            <EvidenceBlock
              icon={<FileText className="size-3.5" aria-hidden="true" />}
              label="Knowledge articles"
              items={insight.supportingArticleIds.map((id) => ({
                id,
                primary: id,
                secondary: "Linked from the AI Decision engine",
              }))}
              emptyText="No knowledge articles linked to this insight."
            />
          </section>

          <section
            aria-label="Related recommendations"
            className="flex flex-col gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Related recommendations
            </p>
            {insight.relatedRecommendations.length === 0 ? (
              <EmptyHint
                icon={
                  <Lightbulb
                    className="size-4"
                    aria-hidden="true"
                  />
                }
                text="No matching recommendations yet."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {insight.relatedRecommendations.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.title}
                      </p>
                      <LevelBadge
                        level={r.priority}
                        tone={levelToTone(r.priority)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.phase} · {r.estimated_timeline}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>
                        Impact{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {r.business_impact}
                        </span>
                      </span>
                      <span>
                        ROI{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {r.estimated_roi}%
                        </span>
                      </span>
                      <span>
                        Score gain{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {r.estimated_score_gain}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Related roadmap items"
            className="flex flex-col gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Related roadmap items
            </p>
            {insight.relatedRoadmapItems.length === 0 ? (
              <EmptyHint
                icon={<Map className="size-4" aria-hidden="true" />}
                text="No matching roadmap items yet."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {insight.relatedRoadmapItems.map((it) => (
                  <li
                    key={it.recommendation_id}
                    className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {it.title}
                      </p>
                      <LevelBadge
                        level={it.priority}
                        tone={levelToTone(it.priority)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {it.phase} · {it.estimated_duration}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>
                        Completion{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {it.completion_percentage}%
                        </span>
                      </span>
                      <span>
                        ROI{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {it.estimated_roi}%
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Why this insight"
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground"
          >
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
              How this insight is built
            </p>
            <p>
              The AI Decision engine produced a summary and a list of
              supporting rule firings. We hydrate each firing, follow the
              supporting rule ids to matching recommendations, and from
              there to the corresponding roadmap items — no derivation
              beyond that join.
            </p>
          </section>
        </div>
      )}
    </SlideOver>
  );
}

interface EvidenceBlockProps {
  icon: React.ReactNode;
  label: string;
  items: { id: string; primary: string; secondary?: string }[];
  emptyText: string;
}

function EvidenceBlock({ icon, label, items, emptyText }: EvidenceBlockProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
      <p className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {items.length}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between gap-2 rounded-sm bg-secondary/30 px-2 py-1 text-xs"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-foreground">
                  {it.primary}
                </span>
                {it.secondary && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {it.secondary}
                  </span>
                )}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {it.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      {icon}
      {text}
    </p>
  );
}
