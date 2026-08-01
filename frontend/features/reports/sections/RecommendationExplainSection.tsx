"use client";

/**
 * RecommendationExplainSection — the "Explain AI" section that
 * lists every recommendation from the advice engine with a
 * collapsible card explaining why it was generated.
 *
 * Each recommendation shows:
 *   - Why was this generated?   (rule firings + supporting ids)
 *   - Business factors considered (related score keys + intelligence keys)
 *   - Confidence score          (real `confidence` % from the payload)
 *   - Expected impact           (real `estimated_score_gain` + `business_impact`)
 *   - Risk level                (priority band derived from `priority`)
 *
 * Collapse state: each card is collapsible via a <details> so the
 * explanation is hidden by default and the page stays scannable. The
 * section header carries a "Expand all / Collapse all" affordance.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Layers,
  Lightbulb,
  Percent,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import {
  confidenceToTone,
  levelToTone,
  scoreTone,
} from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import {
  ACTION_CATEGORY_LABELS,
} from "@/features/action-board/use-action-board-data";
import type { RuleCategory } from "@/types/dashboard";
import type { ReportsData } from "../use-reports-data";
import { ReportSection } from "../ReportSection";
import type { ReportSectionMeta } from "../sections";

const META: ReportSectionMeta = {
  key: "recommendation-summary",
  id: "report-recommendation-explain",
  badge: "Explain AI",
  title: "Explain AI — Why each recommendation was generated",
  caption:
    "Every recommendation the advisor prioritised, with the factors, confidence, expected impact, and risk level that drove it.",
};

interface RecommendationExplainSectionProps {
  data: ReportsData;
}

const PRIORITY_ORDER = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
} as const;

type Recommendation =
  ReportsData["recommendations"]["recommendations"][number];

export function RecommendationExplainSection({
  data,
}: RecommendationExplainSectionProps) {
  const recommendations = data.recommendations.recommendations;
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          a.title.localeCompare(b.title),
      ),
    [recommendations],
  );

  const allOpen = openIds.size === sorted.length && sorted.length > 0;
  const toggleAll = () => {
    setOpenIds(allOpen ? new Set() : new Set(sorted.map((r) => r.id)));
  };
  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ReportSection meta={META}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {sorted.length} recommendation{sorted.length === 1 ? "" : "s"} from
          the advice engine. Click any card to expand the AI explanation.
        </p>
        <button
          type="button"
          onClick={toggleAll}
          aria-pressed={allOpen}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/60"
        >
          {allOpen ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        {sorted.length === 0 ? (
          <li className="rounded-lg border border-border bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
            No recommendations to explain.
          </li>
        ) : (
          sorted.map((rec, i) => (
            <li key={rec.id}>
              <RecommendationExplainCard
                index={i + 1}
                recommendation={rec}
                open={openIds.has(rec.id)}
                onToggle={() => toggle(rec.id)}
              />
            </li>
          ))
        )}
      </ol>
    </ReportSection>
  );
}

// --------------------------------------------------------------------------- //
// One recommendation card
// --------------------------------------------------------------------------- //

interface RecommendationExplainCardProps {
  index: number;
  recommendation: Recommendation;
  open: boolean;
  onToggle: () => void;
}

function RecommendationExplainCard({
  index,
  recommendation,
  open,
  onToggle,
}: RecommendationExplainCardProps) {
  const r = recommendation;
  const confidence = clamp(Number(r.confidence) || 0, 0, 100);
  const confTone = confidenceToTone(confidence);
  const impactRank = impactBand(Number(r.estimated_score_gain) || 0);
  const riskLevel = riskFromPriority(r.priority);
  const categoryLabel =
    ACTION_CATEGORY_LABELS[r.category as RuleCategory] ?? r.category;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-secondary/30 transition-colors",
        open && "border-primary/40 bg-secondary/20",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`explain-${r.id}`}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
          {index}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {r.title || "Untitled recommendation"}
            </span>
            <LevelBadge level={r.priority} tone={levelToTone(r.priority)} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {r.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Percent className="size-3" aria-hidden="true" />
              Confidence{" "}
              <AnimatedCounter
                value={Math.round(confidence)}
                suffix="%"
                className={cn("font-semibold", confTone.tone)}
              />
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="size-3" aria-hidden="true" />
              Impact{" "}
              <span className={cn("font-semibold", scoreTone(impactRank))}>
                +{Math.round(r.estimated_score_gain || 0)} pts
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Risk{" "}
              <span className={cn("font-semibold", scoreTone(riskLevel))}>
                {riskLevel}
              </span>
            </span>
          </div>
        </div>
        <div className="shrink-0 self-center text-muted-foreground">
          {open ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {open && (
        <div
          id={`explain-${r.id}`}
          className="grid grid-cols-1 gap-3 border-t border-border px-3 py-3 md:grid-cols-2"
        >
          <ExplainBlock
            icon={<Lightbulb className="size-3.5" aria-hidden="true" />}
            title="Why was this generated?"
            body={whyGenerated(r)}
          />
          <ExplainBlock
            icon={<Briefcase className="size-3.5" aria-hidden="true" />}
            title="Business factors considered"
            body={factorsConsidered(r)}
          />
          <ExplainBlock
            icon={<Sparkles className="size-3.5" aria-hidden="true" />}
            title="Confidence score"
            body={confidenceBreakdown(r, confidence)}
            tone={confTone.tone}
          />
          <ExplainBlock
            icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
            title="Expected impact"
            body={expectedImpact(r)}
            tone={scoreTone(impactRank)}
          />
          <ExplainBlock
            icon={<AlertTriangle className="size-3.5" aria-hidden="true" />}
            title="Risk level"
            body={riskBreakdown(r, riskLevel)}
            tone={scoreTone(riskLevel)}
          />
          <ExplainBlock
            icon={<Layers className="size-3.5" aria-hidden="true" />}
            title="Supporting evidence"
            body={supportingEvidence(r)}
          />
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Block
// --------------------------------------------------------------------------- //

interface BlockProps {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  tone?: string;
}

function ExplainBlock({ icon, title, body, tone }: BlockProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </span>
      <div className={cn("text-xs leading-relaxed", tone ?? "text-foreground")}>
        {body}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Per-field explanations
// --------------------------------------------------------------------------- //

function whyGenerated(r: Recommendation): React.ReactNode {
  const ruleIds = r.supporting_rule_ids ?? [];
  if (ruleIds.length === 0) {
    return (
      <span>
        Generated by the recommendations engine based on the business
        profile, current scores, and DNA traits. No specific rule firings
        anchor this recommendation.
      </span>
    );
  }
  return (
    <span>
      Generated by the recommendations engine in response to{" "}
      <strong>{ruleIds.length}</strong> rule firing{ruleIds.length === 1 ? "" : "s"}
      : {formatIds(ruleIds)}
    </span>
  );
}

function factorsConsidered(r: Recommendation): React.ReactNode {
  const scoreKeys = r.related_score_keys ?? [];
  const intelKeys = r.related_intelligence_keys ?? [];
  if (scoreKeys.length === 0 && intelKeys.length === 0) {
    return (
      <span>
        No related score or intelligence keys attached. The engine
        weighted the recommendation on the business profile alone.
      </span>
    );
  }
  return (
    <span>
      <strong>{scoreKeys.length}</strong> score key
      {scoreKeys.length === 1 ? "" : "s"} and{" "}
      <strong>{intelKeys.length}</strong> intelligence signal
      {intelKeys.length === 1 ? "" : "s"} fed the call
      {scoreKeys.length + intelKeys.length === 0 ? "" : "."}
      {formatIdList([
        ...scoreKeys.map((k): { kind: "score" | "intel"; k: string } => ({ kind: "score", k })),
        ...intelKeys.map((k): { kind: "score" | "intel"; k: string } => ({ kind: "intel", k })),
      ])}
    </span>
  );
}

function confidenceBreakdown(r: Recommendation, confidence: number): React.ReactNode {
  return (
    <span>
      <strong>{Math.round(confidence)}%</strong> confidence based on the
      strength of supporting rule firings (
      <strong>{r.supporting_rule_ids?.length ?? 0}</strong>) and the
      number of related score keys (
      <strong>{r.related_score_keys?.length ?? 0}</strong>) the engine
      weighted. Difficulty: <em>{r.difficulty}</em>.
    </span>
  );
}

function expectedImpact(r: Recommendation): React.ReactNode {
  const gain = Math.round(r.estimated_score_gain || 0);
  const businessImpact = Math.round(r.business_impact || 0);
  const roi = Math.round(r.estimated_roi || 0);
  const cost = Math.round(r.estimated_cost || 0);
  return (
    <span>
      Estimated +<strong>{gain}</strong> score points, business impact{" "}
      <strong>{businessImpact.toLocaleString()}</strong> ROI{" "}
      <strong>{roi}%</strong> at cost ~<strong>{cost.toLocaleString()}</strong>.
      Phase: <em>{r.phase}</em>, timeline: <em>{r.estimated_timeline}</em>.
    </span>
  );
}

function riskBreakdown(r: Recommendation, riskLevel: string): React.ReactNode {
  const deps = r.dependencies ?? [];
  return (
    <span>
      Risk <strong>{riskLevel}</strong> (priority band {r.priority}).{" "}
      {deps.length > 0
        ? `${deps.length} dependency${deps.length === 1 ? "" : "ies"}: ${formatIds(deps)}.`
        : "No upstream dependencies — this recommendation can run independently."}
    </span>
  );
}

function supportingEvidence(r: Recommendation): React.ReactNode {
  const articles = r.supporting_article_ids ?? [];
  return (
    <span>
      {r.supporting_rule_ids?.length ?? 0} rule anchor
      {(r.supporting_rule_ids?.length ?? 0) === 1 ? "" : "s"},{" "}
      {articles.length} knowledge anchor
      {articles.length === 1 ? "" : "s"}
      {articles.length > 0 ? ` (${formatIds(articles)})` : ""}
      {r.projected_dna_effect
        ? `. Projected DNA effect: ${r.projected_dna_effect}.`
        : "."}
    </span>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function formatIds(ids: string[]): React.ReactNode {
  if (ids.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li
          key={id}
          className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-foreground"
        >
          {id}
        </li>
      ))}
    </ul>
  );
}

function formatIdList(
  items: Array<{ kind: "score" | "intel"; k: string }>,
): React.ReactNode {
  if (items.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {items.map(({ kind, k }) => (
        <li
          key={`${kind}-${k}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-foreground"
        >
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
            {kind}
          </span>
          {k}
        </li>
      ))}
    </ul>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function impactBand(scoreGain: number): "low" | "medium" | "high" {
  if (scoreGain >= 40) return "high";
  if (scoreGain >= 15) return "medium";
  return "low";
}

function riskFromPriority(
  priority: Recommendation["priority"],
): "low" | "medium" | "high" {
  if (priority === "Critical" || priority === "High") return "high";
  if (priority === "Medium") return "medium";
  return "low";
}
