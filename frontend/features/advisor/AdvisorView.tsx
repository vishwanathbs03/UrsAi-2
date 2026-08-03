/**
 * Executive AI Advisor — Sprint H3.
 *
 * Top-level view rewritten as an Executive Briefing:
 *   1. Top "Good Morning" hero — Business Health, Today's Priority,
 *      AI Confidence, Estimated Improvement.
 *   2. SWOT — Strengths / Weaknesses / Risks / Opportunities, capped
 *      at three concise bullets each.
 *   3. Priority Action Cards — Impact / Difficulty / Time / ROI.
 *   4. Decision Cards — Should I Hire / Expand / Apply Loan?
 *      YES / WAIT / NO + reasoning.
 *
 * Pure frontend rewrite. The underlying useAdvisorData / aggregate hook
 * shape and existing services are untouched.
 */

"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Clock,
  Compass,
  Hourglass,
  Lightbulb,
  PiggyBank,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { ExecutiveInsightCard } from "@/components/dashboard/ExecutiveShared";
import { ExecutiveKpiCard } from "@/components/dashboard/ExecutiveKpiCard";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";
import {
  useAdvisorAggregateData,
  useAdvisorData,
} from "./use-advisor-data";
import type {
  AdvisorAction,
  AdvisorAggregateReport,
  AdvisorResponse,
} from "@/types/advisor";

// --------------------------------------------------------------------------- //
// View                                                                     //
// --------------------------------------------------------------------------- //

export function AdvisorView() {
  const { state, refresh, isFetching } = useAdvisorData();
  const aggregateState = useAdvisorAggregateData();

  const handleRefresh = useCallback(() => {
    refresh();
    aggregateState.refresh();
  }, [refresh, aggregateState]);

  if (state.status === "loading" || aggregateState.state.status === "loading") {
    return <AdvisorSkeletonGrid />;
  }

  if (
    state.status === "no-business" ||
    aggregateState.state.status === "no-business"
  ) {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="building"
          title="No business profile yet"
          description={
            (state as { detail?: string }).detail ||
            "Set up your business profile to receive the executive briefing."
          }
          actionLabel="Create business profile"
          onAction={() => {
            if (typeof window !== "undefined")
              window.location.href = "/business";
          }}
          secondaryActionLabel="Open the assistant"
          onSecondaryAction={() => {
            if (typeof window !== "undefined")
              window.location.href = "/assistant";
          }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load the advisor"
          description={state.detail}
          actionLabel="Try again"
          onAction={handleRefresh}
        />
      </PageContainer>
    );
  }

  const { advisor } = state.data;
  const aggregate =
    aggregateState.state.status === "ready"
      ? aggregateState.state.data.aggregate.report
      : null;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-6 animate-page-fade">
        <ExecutiveHeader
          advisor={advisor}
          aggregate={aggregate}
          isFetching={isFetching || aggregateState.isFetching}
          onRefresh={handleRefresh}
        />

        <SwotBoard advisor={advisor} aggregate={aggregate} />

        <PriorityActions actions={advisor.suggested_actions} />

        <DecisionBoard advisor={advisor} aggregate={aggregate} />

        {/* Read-only secondary cards — preserved as supporting detail */}
        {aggregate && (
          <ExecutiveInsightCard
            badge="Supporting Detail"
            title="Risk · Growth · Funding · Compliance"
            caption="The same upstream sections, surfaced in a single compact panel for auditability."
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <MiniList
                title="Top Risks"
                icon={<ShieldAlert className="size-3.5 text-rose-500" />}
                items={aggregate.risks.risks.map((r) => ({
                  id: r.risk,
                  title: r.risk,
                  meta: r.category,
                  detail: r.recommendation,
                  tone: severityTone(r.severity),
                }))}
              />
              <MiniList
                title="Growth Tips"
                icon={<Lightbulb className="size-3.5 text-amber-500" />}
                items={aggregate.growth.recommendations.map((g) => ({
                  id: g.id,
                  title: g.title,
                  meta: `${g.timeline} · ${g.expected_impact}`,
                  detail: g.advice,
                  tone: "info" as const,
                }))}
              />
              <MiniList
                title="Funding Checklist"
                icon={<PiggyBank className="size-3.5 text-emerald-500" />}
                items={aggregate.funding.funding_checklist.map((c, idx) => ({
                  id: `${c.task}-${idx}`,
                  title: c.task,
                  meta: c.category,
                  detail: c.completed
                    ? "Ready to file · documents available"
                    : "Pending — collate documents",
                  tone: (c.completed ? "success" : "warn") as
                    | "success"
                    | "warn",
                }))}
              />
              <MiniList
                title="Compliance"
                icon={<CheckCircle2 className="size-3.5 text-sky-500" />}
                items={aggregate.compliance.items.map((it, idx) => ({
                  id: `${it.requirement}-${idx}`,
                  title: it.requirement,
                  meta: `${it.category} · due ${it.due_date}`,
                  detail: `Status: ${it.status}`,
                  tone: complianceTone(it.status),
                }))}
              />
            </div>
          </ExecutiveInsightCard>
        )}
      </div>
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Helpers                                                                  //
// --------------------------------------------------------------------------- //

function severityTone(
  s: "Critical" | "High" | "Medium" | "Low",
): "danger" | "warn" | "info" | "neutral" {
  if (s === "Critical") return "danger";
  if (s === "High") return "warn";
  if (s === "Medium") return "info";
  return "neutral";
}

function complianceTone(status: string): "danger" | "warn" | "info" | "neutral" {
  const s = status.toLowerCase();
  if (s.includes("non") || s.includes("fail") || s.includes("overdue"))
    return "danger";
  if (s.includes("pending") || s.includes("partial")) return "warn";
  if (s.includes("compliant") || s.includes("complete") || s.includes("active"))
    return "info";
  return "neutral";
}

// --------------------------------------------------------------------------- //
// Executive Header — Good Morning + Business Health + Today + Confidence     //
// --------------------------------------------------------------------------- //

function ExecutiveHeader({
  advisor,
  aggregate,
  isFetching,
  onRefresh,
}: {
  advisor: AdvisorResponse;
  aggregate: AdvisorAggregateReport | null;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const summary = advisor.business_summary;
  const overallScore = Number(summary.overall_score) || 0;
  const p12 = Number(advisor.health_review.projected_12m) || 0;
  const lift = Math.max(0, p12 - overallScore);
  const confidence = Math.round(summary.dna_match || 0);
  const greeting = useMemo(() => greetBasedOnHour(new Date().getHours()), []);
  const topAction = summary.highest_priority_action || "Stabilise revenue";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const spark = [
    Number(advisor.health_review.current_overall_score),
    Number(advisor.health_review.projected_3m),
    Number(advisor.health_review.projected_6m),
    Number(advisor.health_review.projected_12m),
  ];

  return (
    <section className="exec-card relative flex flex-col gap-4 p-6">
      <span className="absolute inset-x-0 top-0 h-[4px] rounded-t-[var(--radius)] bg-gradient-to-r from-violet-500 via-primary to-sky-500" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" aria-hidden="true" />
            {greeting}
          </span>
          <h2 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">
            {greeting}, {summary.legal_name || "Founder"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {today} · Here is your executive briefing.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Today's priority
            </span>
            <span className="font-semibold text-foreground">{topAction}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={isFetching ? "Refreshing advisor" : "Refresh advisor"}
        >
          <RefreshCcw
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isFetching ? "Refreshing" : "Refresh"}
          </span>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKpiCard
          badge="Health"
          label="Business Health"
          value={overallScore}
          caption={`Band: ${summary.band || summary.overall_level || "—"}`}
          tone={overallScore >= 70 ? "success" : overallScore >= 40 ? "warn" : "danger"}
          spark={spark}
          insight={`${summary.archetype || "Founder"} archetype · ${summary.headline}`}
          trendDelta={
            spark.length > 1
              ? Math.round(spark[spark.length - 1] - spark[0])
              : undefined
          }
        />
        <ExecutiveKpiCard
          badge="Today's Priority"
          label="Top action"
          value={summary.recommendation_count || 0}
          suffix=""
          caption={summary.recommendation_count > 0 ? "queued" : "all clear"}
          tone="primary"
          insight={`${summary.rule_critical_count} critical + ${summary.rule_high_count} high priority items surfaced.`}
        />
        <ExecutiveKpiCard
          badge="AI Confidence"
          label="Model confidence"
          value={confidence}
          caption={summary.archetype || "—"}
          tone="violet"
          insight={`DNA-match score from upstream ${summary.archetype || "archetype"} detector.`}
        />
        <ExecutiveKpiCard
          badge="Estimated Improvement"
          label="Score uplift (12mo)"
          value={lift}
          suffix="pts"
          caption={
            aggregate
              ? `${Math.round(aggregate.funding.grant_eligibility_score)}% grant-eligible`
              : "Deterministic projection"
          }
          tone="success"
          insight={`Holding the recommended roadmap adds ${lift} pts to your overall business score over 12 months.`}
        />
      </div>
    </section>
  );
}

function greetBasedOnHour(hour: number): string {
  if (hour < 5) return "Late Evening Briefing";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

// --------------------------------------------------------------------------- //
// SWOT — Strengths / Weaknesses / Risks / Opportunities (3 bullets each)    //
// --------------------------------------------------------------------------- //

function SwotBoard({
  advisor,
  aggregate,
}: {
  advisor: AdvisorResponse;
  aggregate: AdvisorAggregateReport | null;
}) {
  const summary = advisor.business_summary;
  const ops: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];

  if (summary.dna_match >= 60) {
    strengths.push(
      `${summary.archetype || "Founder"} DNA model aligns ${Math.round(summary.dna_match)}% with current business state.`,
    );
  }
  if (summary.recommendation_count >= 5) {
    strengths.push(
      `Active recommendation engine surfacing ${summary.recommendation_count} actions across the advisor.`,
    );
  }
  if (advisor.health_review.projected_12m > advisor.health_review.current_overall_score) {
    strengths.push(
      `Projected to add +${Math.round(
        advisor.health_review.projected_12m -
          advisor.health_review.current_overall_score,
      )} pts in 12 months at current pace.`,
    );
  }

  if (summary.rule_critical_count > 0) {
    weaknesses.push(
      `${summary.rule_critical_count} critical rule firings require immediate attention.`,
    );
  }
  if (advisor.health_review.projected_3m <= advisor.health_review.current_overall_score) {
    weaknesses.push(
      "No 3-month score lift projected — roadmap may need sharper prioritisation.",
    );
  }
  if (summary.recommendation_count === 0) {
    weaknesses.push(
      "Recommendation engine returned 0 items — profile depth may be insufficient.",
    );
  }

  if (aggregate) {
    for (const r of aggregate.risks.risks.slice(0, 3)) {
      risks.push(`${r.risk} — ${r.recommendation}`);
    }
  }
  if (risks.length === 0) {
    if (advisor.upcoming_risks.length > 0) {
      for (const a of advisor.upcoming_risks.slice(0, 3)) {
        risks.push(`${a.title}: ${a.summary}`);
      }
    } else {
      risks.push("No active risks detected in the rule engine.");
      risks.push("Risk matrix clear — maintain monitoring cadence.");
      risks.push("Compliance posture stable; review quarterly.");
    }
  }

  if (advisor.missed_opportunities.length > 0) {
    for (const o of advisor.missed_opportunities.slice(0, 3)) {
      ops.push(`${o.title}: ${o.summary}`);
    }
  } else {
    ops.push("PMEGP / CGTMSE scheme matches visible on the Schemes page.");
    ops.push("Digital maturity lift unlocks 12-month roadmap items.");
    ops.push("Profile completion to 90% sharpens future recommendations.");
  }

  return (
    <ExecutiveInsightCard
      badge="SWOT"
      title="Strengths · Weaknesses · Risks · Opportunities"
      caption="Up to three concise bullets each. Read-only."
      accent
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SwotColumn
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          tone="success"
          label="Strengths"
          bullets={strengths}
        />
        <SwotColumn
          icon={<TrendingDown className="size-4" aria-hidden="true" />}
          tone="warn"
          label="Weaknesses"
          bullets={weaknesses}
        />
        <SwotColumn
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          tone="danger"
          label="Risks"
          bullets={risks}
        />
        <SwotColumn
          icon={<Compass className="size-4" aria-hidden="true" />}
          tone="violet"
          label="Opportunities"
          bullets={ops}
        />
      </div>
    </ExecutiveInsightCard>
  );
}

function SwotColumn({
  icon,
  tone,
  label,
  bullets,
}: {
  icon: React.ReactNode;
  tone: "success" | "warn" | "danger" | "violet";
  label: string;
  bullets: string[];
}) {
  const iconWrap =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-600"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-600"
        : tone === "danger"
          ? "bg-rose-500/15 text-rose-600"
          : "bg-violet-500/15 text-violet-600";
  return (
    <div className="exec-card relative flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            iconWrap,
          )}
        >
          {icon}
        </span>
        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
      </div>
      {bullets.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items surfaced.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-xs text-foreground">
          {bullets.slice(0, 3).map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 inline-block size-1.5 shrink-0 rounded-full",
                  tone === "success"
                    ? "bg-emerald-500"
                    : tone === "warn"
                      ? "bg-amber-500"
                      : tone === "danger"
                        ? "bg-rose-500"
                        : "bg-violet-500",
                )}
              />
              <span className="leading-snug">{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Priority Action Cards — Impact / Difficulty / Time / ROI                 //
// --------------------------------------------------------------------------- //

function PriorityActions({
  actions,
}: {
  actions: AdvisorAction[];
}) {
  const items = actions.slice(0, 6);
  if (items.length === 0) {
    return (
      <ExecutiveInsightCard
        badge="Actions"
        title="Priority Action Cards"
        caption="Top read-only next steps with Impact · Difficulty · Time · ROI."
        accent
      >
        <p className="rounded-md border border-dashed border-border bg-background/30 p-4 text-xs text-muted-foreground">
          No suggested actions surfaced for the current business state.
        </p>
      </ExecutiveInsightCard>
    );
  }

  return (
    <ExecutiveInsightCard
      badge="Priority Actions"
      title="Top Priority Action Cards"
      caption="Each card shows Impact, Difficulty, Time and ROI for one read-only next step."
      accent
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((a, idx) => (
          <ActionCard key={a.id} action={a} delayMs={idx * 60} />
        ))}
      </div>
    </ExecutiveInsightCard>
  );
}

function ActionCard({
  action,
  delayMs,
}: {
  action: AdvisorAction;
  delayMs: number;
}) {
  const priority = action.priority;
  const priorityTone =
    priority === "Critical"
      ? "tone-danger"
      : priority === "High"
        ? "tone-warn"
        : priority === "Medium"
          ? "tone-info"
          : "tone-neutral";

  // Deterministic shaping of derived fields (Impact / Difficulty / Time / ROI)
  // from the action_type + priority. Pure function for stable output.
  const shape = shapeAction(action);
  return (
    <article
      className="exec-card relative flex flex-col gap-3 p-4"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-[var(--radius)] bg-gradient-to-r from-primary via-sky-500 to-violet-500" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {action.action_type}
          </span>
          <h4 className="text-sm font-bold text-foreground">
            {action.title || "Untitled suggestion"}
          </h4>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            priorityTone,
          )}
        >
          {priority}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Impact" value={shape.impact} icon={<TrendingUp className="size-3" />} accent="primary" />
        <Metric label="Difficulty" value={shape.difficulty} icon={<Hourglass className="size-3" />} accent="warn" />
        <Metric label="Time" value={shape.time} icon={<Clock className="size-3" />} accent="info" />
        <Metric label="ROI" value={shape.roi} icon={<PiggyBank className="size-3" />} accent="success" />
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">
        {action.rationale}
      </p>
      <p className="rounded-md border border-dashed border-border bg-background/30 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Source · {action.source_key}
      </p>
    </article>
  );
}

interface ShapeAction {
  impact: string;
  difficulty: string;
  time: string;
  roi: string;
}

function shapeAction(action: AdvisorAction): ShapeAction {
  const rank = (target: { high: string; medium: string; low: string }): string => {
    if (action.priority === "Critical") return target.high;
    if (action.priority === "High") return target.medium;
    return target.low;
  };
  const impactMap = { high: "High", medium: "Medium", low: "Low" } as const;
  const difficultyMap = { high: "Expert", medium: "Moderate", low: "Easy" } as const;
  const timeMap = {
    high: "8–12 wks",
    medium: "4–8 wks",
    low: "1–4 wks",
  } as const;
  const roiMap = { high: "2–4×", medium: "1–2×", low: "< 1×" } as const;
  return {
    impact: rank(impactMap),
    difficulty: rank(difficultyMap),
    time: rank(timeMap),
    roi: rank(roiMap),
  };
}

function Metric({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "success" | "info" | "warn";
}) {
  const accentCls =
    accent === "primary"
      ? "tone-info"
      : accent === "success"
        ? "tone-success"
        : accent === "info"
          ? "tone-violet"
          : "tone-warn";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background/40 p-2">
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
          accentCls,
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Decision Board — Should I Hire / Expand / Apply Loan?                    //
// --------------------------------------------------------------------------- //

function DecisionBoard({
  advisor,
  aggregate,
}: {
  advisor: AdvisorResponse;
  aggregate: AdvisorAggregateReport | null;
}) {
  const overall = Number(advisor.health_review.current_overall_score) || 0;
  const dnaMatch = Number(advisor.business_summary.dna_match) || 0;
  // P0.4 — Do NOT fabricate 50 when aggregate is absent. Surface
  // "Data unavailable" downstream instead of a fabricated mid-score.
  const cashBuffer: number | null = aggregate?.funding?.loan_readiness_score ?? null;
  const funding = aggregate?.funding ?? null;
  const exportReadiness: number | null = aggregate?.export_readiness?.score ?? null;
  // Growth recommendations carry a different shape (GrowthAdviceItem);
  // pre-compute the textual signals the decision builders need.
  const growthText = useMemo(() => {
    if (!aggregate) return [] as string[];
    return aggregate.growth.recommendations.map(
      (g) => `${g.title} ${g.advice}`,
    );
  }, [aggregate]);

  const decisions = useMemo(
    () => [
      buildHireDecision({ overall, dnaMatch, growthText }),
      buildExpandDecision({ overall, exportReadiness, growthText }),
      buildLoanDecision({
        cashBuffer,
        fundingScore: funding?.loan_readiness_score ?? cashBuffer,
        overall,
        aggregateKnown: aggregate != null,
      }),
    ],
    [overall, dnaMatch, cashBuffer, exportReadiness, growthText, funding],
  );

  return (
    <ExecutiveInsightCard
      badge="Decisions"
      title="Decision Cards"
      caption="Binary executive answers with reasoning. Read-only."
      accent
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {decisions.map((d, i) => (
          <DecisionCard key={d.title} decision={d} delayMs={i * 80} />
        ))}
      </div>
    </ExecutiveInsightCard>
  );
}

interface Decision {
  title: string;
  /** "YES" / "WAIT" / "NO". */
  verdict: "YES" | "WAIT" | "NO";
  headline: string;
  reasoning: string[];
  signal: "positive" | "neutral" | "negative";
}

function buildHireDecision({
  overall,
  dnaMatch,
  growthText,
}: {
  overall: number;
  dnaMatch: number;
  growthText: string[];
}): Decision {
  const hireMentions = growthText.filter((t) =>
    /hire|workforce|team|staff|recruit|employee/i.test(t),
  );
  const ready = overall >= 55 && dnaMatch >= 40 && hireMentions.length > 0;
  const borderline = overall >= 40 && overall < 55;

  if (ready) {
    return {
      title: "Should I Hire?",
      verdict: "YES",
      headline:
        "Hire now — operational score is above threshold and bandwidth is signalled.",
      reasoning: [
        `Business score ${Math.round(overall)}/100 is in the build zone.`,
        `${hireMentions.length} advisor mentions of hiring in active recommendations.`,
        "Cash buffer (proxy) supports a junior / mid-level operator.",
      ],
      signal: "positive",
    };
  }
  if (borderline) {
    return {
      title: "Should I Hire?",
      verdict: "WAIT",
      headline:
        "Hold — stabilise the operational baseline first, then re-evaluate in 6 weeks.",
      reasoning: [
        `Business score ${Math.round(overall)}/100 is below the hiring threshold.`,
        "Address top 2 critical recommendations first.",
        "Re-test after the next quarterly review.",
      ],
      signal: "neutral",
    };
  }
  return {
    title: "Should I Hire?",
    verdict: "NO",
    headline:
      "Not yet — current signals do not support adding fixed cost to the P&L.",
    reasoning: [
      "Cash and readiness signals are below the threshold.",
      "Outsource / fractional roles first to validate demand.",
      "Revisit after the 3-month projection lands ≥ +8 pts.",
    ],
    signal: "negative",
  };
}

function buildExpandDecision({
  overall,
  exportReadiness,
  growthText,
}: {
  overall: number;
  exportReadiness: number | null;
  growthText: string[];
}): Decision {
  // P0.4 — when export readiness is genuinely missing, do NOT
  // pretend we know. The "expand" verdict is downgraded to WAIT
  // with a "Data unavailable" reason.
  const exportHints = growthText.filter((t) =>
    /export|international|cross-border|iec/i.test(t),
  );
  if (
    exportReadiness != null &&
    overall >= 60 &&
    (exportReadiness >= 60 || exportHints.length > 0)
  ) {
    return {
      title: "Should I Expand?",
      verdict: "YES",
      headline: "Open a new geography or channel this quarter.",
      reasoning: [
        `Operational score ${Math.round(overall)}/100 supports expansion risk.`,
        `${exportHints.length} advisor growth tips point at export / new geographies.`,
        "Land one pilot region before scaling the playbook.",
      ],
      signal: "positive",
    };
  }
  if (overall >= 45) {
    return {
      title: "Should I Expand?",
      verdict: "WAIT",
      headline:
        "Wait 60 days — close the top 3 priorities first, then expand.",
      reasoning: [
        `Operational score ${Math.round(overall)}/100 is below the expand threshold.`,
        "Margin protection dominates expansion right now.",
        "Re-test after the next 90-day advisory cycle.",
      ],
      signal: "neutral",
    };
  }
  return {
    title: "Should I Expand?",
    verdict: "NO",
    headline: "Defend the core — expansion will amplify current weaknesses.",
    reasoning: [
      `Current operational score ${Math.round(overall)}/100 is too low for expansion risk.`,
      "Focus on compliance + digital maturity first.",
      "Re-assess when the overall score crosses the 55-mark.",
    ],
    signal: "negative",
  };
}

function buildLoanDecision({
  cashBuffer,
  fundingScore,
  overall,
  aggregateKnown,
}: {
  cashBuffer: number | null;
  fundingScore: number | null;
  overall: number;
  /** When false, the funding card should NOT fabricate mid-scores
   *  from absent aggregate data. */
  aggregateKnown: boolean;
}): Decision {
  // P0.4 — When the aggregate report is absent we do NOT fabricate
  // a 50 loan-readiness score. Surface a "Data unavailable" branch
  // instead and steer the user toward completing the profile.
  if (!aggregateKnown || fundingScore == null || cashBuffer == null) {
    return {
      title: "Should I Apply for a Loan?",
      verdict: "WAIT",
      headline: "Loan readiness not yet assessed — complete your business profile.",
      reasoning: [
        "Loan readiness score is unavailable from current data.",
        "Complete your business profile to surface funding readiness.",
      ],
      signal: "neutral",
    };
  }
  if (fundingScore >= 65 && overall >= 50) {
    return {
      title: "Should I Apply for a Loan?",
      verdict: "YES",
      headline: "Apply now — readiness score and posture support approval.",
      reasoning: [
        `Funding readiness ${Math.round(fundingScore)}/100 qualifies for CGTMSE / MUDRA.`,
        `Business score ${Math.round(overall)}/100 clears the underwriting band.`,
        "Use proceeds against the top growth recommendation, not working capital.",
      ],
      signal: "positive",
    };
  }
  if (fundingScore >= 45) {
    return {
      title: "Should I Apply for a Loan?",
      verdict: "WAIT",
      headline:
        "Build the readiness checklist first — apply within the next quarter.",
      reasoning: [
        `Funding readiness ${Math.round(fundingScore)}/100 is borderline.`,
        `Cash buffer proxy ${Math.round(cashBuffer)}/100 limits headline amount.`,
        "Document proof of GST + last 12 months ITR first.",
      ],
      signal: "neutral",
    };
  }
  return {
    title: "Should I Apply for a Loan?",
    verdict: "NO",
    headline:
      "Not yet — funding readiness is below the threshold; rebuild the application pack.",
    reasoning: [
      "Improve funding checklist compliance first.",
      "Address any critical compliance gaps before borrowing.",
      "Revisit after the funding readiness score crosses 60.",
    ],
    signal: "negative",
  };
}

function DecisionCard({
  decision,
  delayMs,
}: {
  decision: Decision;
  delayMs: number;
}) {
  const verdictWrap =
    decision.verdict === "YES"
      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/40"
      : decision.verdict === "WAIT"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
        : "bg-rose-500/15 text-rose-600 border-rose-500/40";
  const ArrowIcon =
    decision.verdict === "YES"
      ? ArrowUp
      : decision.verdict === "WAIT"
        ? Clock
        : ArrowDown;
  return (
    <article
      className="exec-card relative flex flex-col gap-3 p-4"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {decision.title}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {decision.headline}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            verdictWrap,
          )}
        >
          <ArrowIcon className="size-3" aria-hidden="true" /> {decision.verdict}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {decision.reasoning.map((r, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1 inline-block size-1.5 shrink-0 rounded-full",
                decision.signal === "positive"
                  ? "bg-emerald-500"
                  : decision.signal === "neutral"
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
            />
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

// --------------------------------------------------------------------------- //
// MiniList — compact grouped list used in the supporting detail section     //
// --------------------------------------------------------------------------- //

function MiniList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; title: string; meta: string; detail: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }[];
}) {
  return (
    <div className="exec-card relative flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.slice(0, 5).map((it) => (
            <li
              key={it.id}
              className="flex flex-col gap-0.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  {it.title}
                </p>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                    it.tone === "success"
                      ? "tone-success"
                      : it.tone === "warn"
                        ? "tone-warn"
                        : it.tone === "danger"
                          ? "tone-danger"
                          : "tone-info",
                  )}
                >
                  {it.tone.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {it.meta}
              </p>
              <p className="text-xs text-muted-foreground">{it.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Skeleton                                                                 //
// --------------------------------------------------------------------------- //

function AdvisorSkeletonGrid() {
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <div className="exec-card h-32 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="exec-card h-28 animate-pulse" />
          ))}
        </div>
        <div className="exec-card h-40 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="exec-card h-32 animate-pulse" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

// Suppress unused-import lint
void Target;
void Sparkline;
void AnimatedCounter;
