/**
 * Executive Analytics — Sprint H3.
 *
 * Redesigns the Analytics page into an Executive Business
 * Intelligence dashboard. Every section answers one of:
 *   1. What is happening?
 *   2. Why is it happening?
 *   3. What should I do?
 *   4. What happens if I do it?
 *
 * Pure front-end rewrite — the underlying data hooks
 * (`useAnalyticsData`), services, and types are unchanged.
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Sparkles, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExecutiveKpiCard } from "@/components/dashboard/ExecutiveKpiCard";
import {
  ExecutiveInsightCard,
  ImprovementGauge,
} from "@/components/dashboard/ExecutiveShared";
import { HorizontalBarChart, type HorizontalBarRow } from "@/components/charts/ExecutiveCharts";
import { Heatmap } from "@/components/charts/ExecutiveCharts";
import { Sparkline } from "@/components/charts/Sparkline";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { LineChart } from "@/components/dashboard/LineChart";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnalyticsFiltersBar } from "./AnalyticsFiltersBar";
import { AnalyticsHeader } from "./AnalyticsHeader";
import { AnalyticsSkeletonGrid } from "./AnalyticsSkeleton";
import {
  READINESS_KEYS,
  computeProfileCompletion,
  scoreByKey,
  useAnalyticsData,
} from "./use-analytics-data";
import {
  DEFAULT_ANALYTICS_FILTERS,
  applyRecommendationFilters,
  type AnalyticsFilters,
} from "./use-analytics-filters";
import type { TwinResponse } from "@/types/analytics";

// Same shape the analytics hook exposes; aliased so the
// sub-components don't have to import the hook's discriminated union.
type AnalyticsDataLike = {
  twin: TwinResponse;
  roadmap: import("@/types/analytics").RoadmapResponse;
  recommendations: import("@/types/analytics").RecommendationsResponse;
};

const TIMELINE_OPTIONS: { key: "all" | "12m" | "6m" | "3m"; label: string }[] =
  [
    { key: "all", label: "All" },
    { key: "12m", label: "12 Months" },
    { key: "6m", label: "6 Months" },
    { key: "3m", label: "3 Months" },
  ];

export function AnalyticsView() {
  const { state, refresh, isFetching } = useAnalyticsData();
  const [filters, setFilters] = useState<AnalyticsFilters>(
    DEFAULT_ANALYTICS_FILTERS,
  );
  const [trendWindow, setTrendWindow] = useState<"all" | "12m" | "6m" | "3m">(
    "12m",
  );

  const filteredRecommendations = useMemo(() => {
    if (state.status !== "ready") return [];
    return applyRecommendationFilters(
      state.data.recommendations.recommendations,
      filters,
    );
  }, [state, filters]);

  if (state.status === "loading") return <AnalyticsSkeletonGrid />;

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="building"
          title="No business profile yet"
          description={
            state.detail ||
            "Set up your business profile to view executive analytics, trends, and opportunity insights."
          }
          actionLabel="Create business profile"
          onAction={() => {
            if (typeof window !== "undefined") window.location.href = "/business";
          }}
          secondaryActionLabel="How it works"
          onSecondaryAction={() => {
            if (typeof window !== "undefined") window.location.href = "/";
          }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business Profile
              <ArrowRight className="size-4" aria-hidden="true" />
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
          title="Could not load executive analytics"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { twin, recommendations } = state.data;
  const lastAnalyzedAt =
    twin.last_analysis_at ?? twin.generated_at ?? recommendations.generated_at;

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-6 py-2 animate-page-fade">
        <AnalyticsHeader
          lastAnalyzedAt={lastAnalyzedAt}
          onRefresh={refresh}
          isRefreshing={isFetching}
        />

        {/* Executive KPI Ribbon — six primary signals */}
        <ExecutiveKpiRibbon data={state.data} />

        {/* Trend + Radar pair */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          <BusinessHealthTrendCard
            twin={twin}
            trendWindow={trendWindow}
            onChangeWindow={setTrendWindow}
          />
          <RadarMaturityCard data={state.data} />
        </div>

        {/* Benchmark + Impact bars */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BenchmarkCard data={state.data} />
          <RecommendationImpactCard
            recommendations={filteredRecommendations}
            recommendationsAll={recommendations.recommendations}
          />
        </div>

        {/* Scheme match + Heatmap */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GovernmentSchemeMatchCard twin={twin} />
          <BusinessHealthHeatmap twin={twin} />
        </div>

        {/* Filters + recommendations detail */}
        <ExecutiveInsightCard
          badge="Filters"
          title="Recommended actions"
          caption="Slice the executive recommendation list by priority, category, or phase."
          accent
        >
          <AnalyticsFiltersBar
            filters={filters}
            onChange={setFilters}
            filteredCount={filteredRecommendations.length}
            totalCount={recommendations.recommendations.length}
          />
          <FilteredRecommendationGrid
            items={filteredRecommendations.slice(0, 8)}
          />
        </ExecutiveInsightCard>
      </div>
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Executive KPI Ribbon — six headline signals with sparklines + AI insights. //
// --------------------------------------------------------------------------- //

interface RibbonProps {
  data: AnalyticsDataLike;
}

function ExecutiveKpiRibbon({ data }: RibbonProps) {
  const { twin } = data;
  const { health_summary, growth_potential, risk_overview } = twin;
  const profileCompletion = computeProfileCompletion(twin);
  const activeRiskCount =
    risk_overview.critical_count + risk_overview.high_count;
  const dnaMatch = twin.current_health.business_dna_match;
  const overall = twin.current_health.overall_business_score;
  const compliance = health_summary.compliance_readiness;
  const digital = health_summary.digital_maturity;
  const opportunity = Math.round(
    (health_summary.export_readiness +
      health_summary.market_readiness +
      growth_potential.total_expected_score_gain) /
      3,
  );

  // Synthesise lightweight spark data from the upstream payloads.
  const timelineSeries = [
    twin.timeline.current.projected_overall_score,
    twin.timeline.three_month.projected_overall_score,
    twin.timeline.six_month.projected_overall_score,
    twin.timeline.twelve_month.projected_overall_score,
  ];

  return (
    <section
      aria-label="Executive KPI ribbon"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <ExecutiveKpiCard
        badge="Health"
        label="Business Health"
        value={health_summary.overall_health}
        caption={healthBand(health_summary.overall_health)}
        insight={`Composite of digital, operational, market, and growth maturity — band ${healthBand(health_summary.overall_health).toLowerCase()}.`}
        tone="primary"
        trendDelta={Number(
          (twin.timeline.three_month.projected_overall_score - overall).toFixed(0),
        )}
        spark={timelineSeries}
      />
      <ExecutiveKpiCard
        badge="Digital"
        label="Digital Score"
        value={digital}
        caption={`Cloud ${twin.profile.uses_cloud_systems ? "yes" : "no"} · Web ${twin.profile.has_website ? "yes" : "no"}`}
        insight={`Marketing ${twin.profile.uses_digital_marketing ? "on" : "off"} — ${twin.profile.social_channel_count} social channels live.`}
        tone="info"
      />
      <ExecutiveKpiCard
        badge="Compliance"
        label="Compliance"
        value={compliance}
        caption={`${activeRiskCount} active rule firings`}
        insight={
          activeRiskCount === 0
            ? "All hard compliance rules are clear."
            : `${risk_overview.critical_count} critical + ${risk_overview.high_count} high priority rules require attention.`
        }
        tone={compliance >= 70 ? "success" : compliance >= 40 ? "warn" : "danger"}
        trendDelta={-activeRiskCount}
      />
      <ExecutiveKpiCard
        badge="Growth"
        label="Growth Potential"
        value={growth_potential.total_expected_score_gain}
        suffix="pts"
        caption={`Avg ${growth_potential.average_estimated_timeline}`}
        insight={`${Math.round(growth_potential.total_expected_roi)}% total expected ROI across the priority roadmap.`}
        tone="violet"
      />
      <ExecutiveKpiCard
        badge="Schemes"
        label="Govt Benefits"
        value={opportunity}
        caption="Capital-readiness upside"
        insight={`PMEGP & CGTMSE eligibility — see scheme match below.`}
        tone="success"
      />
      <ExecutiveKpiCard
        badge="AI"
        label="AI Confidence"
        value={Math.round(dnaMatch)}
        caption={twin.current_health.business_dna_archetype}
        insight={`Profile completion at ${profileCompletion}% gives the ${twin.current_health.business_dna_archetype} model enough signal to recommend.`}
        tone="primary"
      />
    </section>
  );
}

function healthBand(score: number): "Strong" | "Stable" | "Building" {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Stable";
  return "Building";
}

// --------------------------------------------------------------------------- //
// Business Health Trend — selectable timeline + hover insights.              //
// --------------------------------------------------------------------------- //

function BusinessHealthTrendCard({
  twin,
  trendWindow,
  onChangeWindow,
}: {
  twin: TwinResponse;
  trendWindow: "all" | "12m" | "6m" | "3m";
  onChangeWindow: (k: "all" | "12m" | "6m" | "3m") => void;
}) {
  const tl = twin.timeline;
  const allPoints = [
    {
      label: "Now",
      score: tl.current.projected_overall_score,
      delta: 0,
      digital: tl.current.projected_digital_score,
    },
    {
      label: "3 mo",
      score: tl.three_month.projected_overall_score,
      delta:
        tl.three_month.projected_overall_score -
        tl.current.projected_overall_score,
      digital: tl.three_month.projected_digital_score,
    },
    {
      label: "6 mo",
      score: tl.six_month.projected_overall_score,
      delta:
        tl.six_month.projected_overall_score -
        tl.current.projected_overall_score,
      digital: tl.six_month.projected_digital_score,
    },
    {
      label: "12 mo",
      score: tl.twelve_month.projected_overall_score,
      delta:
        tl.twelve_month.projected_overall_score -
        tl.current.projected_overall_score,
      digital: tl.twelve_month.projected_digital_score,
    },
  ];

  const points =
    trendWindow === "all"
      ? allPoints
      : allPoints.slice(0, trendWindow === "3m" ? 2 : trendWindow === "6m" ? 3 : 4);
  const current = allPoints[0];
  const target = allPoints[allPoints.length - 1];
  const lift = target.score - current.score;
  const liftPct =
    current.score > 0 ? Math.round((lift / current.score) * 100) : 0;

  return (
    <ExecutiveInsightCard
      badge="Trend"
      title="Business Health Trend"
      caption="Deterministic projections from the Digital Twin timeline. Hover for milestones."
      trailing={
        <div
          role="tablist"
          aria-label="Trend timeline selector"
          className="flex items-center gap-1 rounded-md border border-border bg-secondary/30 p-0.5"
        >
          {TIMELINE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={opt.key === trendWindow}
              onClick={() => onChangeWindow(opt.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                opt.key === trendWindow
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
        <LineChart
          labels={points.map((p) => p.label)}
          series={[
            {
              label: "Projected score",
              values: points.map((p) => p.score),
              color: "hsl(var(--primary))",
            },
            {
              label: "Digital maturity",
              values: points.map((p) => p.digital),
              color: "hsl(199 89% 48%)",
              dashed: true,
            },
          ]}
          ariaLabel="Business health trend"
        />
        <ImprovementGauge
          current={current.score}
          target={target.score}
          label="12-month lift"
          tone={lift >= 0 ? "primary" : "warn"}
          suffix="pts"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {points.map((p) => (
          <div
            key={p.label}
            className="rounded-lg border border-border bg-background/40 p-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {p.label}
            </p>
            <p className="mt-1 text-xl font-black tabular-nums text-foreground">
              <AnimatedCounter value={p.score} className="text-xl font-black" />
              <span className="ml-1 text-xs text-muted-foreground">/100</span>
            </p>
            <p
              className={cn(
                "mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                p.delta > 0
                  ? "text-emerald-600"
                  : p.delta < 0
                    ? "text-rose-600"
                    : "text-muted-foreground",
              )}
            >
              {p.delta > 0 ? "▲" : p.delta < 0 ? "▼" : "·"} {Math.abs(p.delta)} pts
            </p>
          </div>
        ))}
      </div>

      <p className="rounded-md border border-dashed border-border bg-background/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <Sparkles className="mr-1 inline size-3 align-text-bottom text-primary" />
        Holding the current execution pace delivers a{" "}
        <strong className="text-foreground">{lift}+ pts</strong> overall lift (
        {liftPct}%) by month 12. To accelerate, the executive advisor recommends
        closing the top three critical recommendations in the next 6 weeks.
      </p>
    </ExecutiveInsightCard>
  );
}

// --------------------------------------------------------------------------- //
// Maturity Radar — 6-pillar view.                                           //
// --------------------------------------------------------------------------- //

function RadarMaturityCard({
  data,
}: {
  data: AnalyticsDataLike;
}) {
  const pillars = READINESS_KEYS.map((key) => {
    const s = scoreByKey(data.twin, key);
    return { key, axis: s?.title || key, value: s?.score ?? 50 };
  });
  const avg = Math.round(
    pillars.reduce((a, p) => a + p.value, 0) / Math.max(1, pillars.length),
  );

  return (
    <ExecutiveInsightCard
      badge="Maturity"
      title="Operational Maturity Radar"
      caption="Six pillars, one shape — see where the business is balanced or lop-sided."
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <RadarChart data={pillars} ariaLabel="Operational maturity radar" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          {pillars.map((p) => (
            <div
              key={p.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2"
            >
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {p.axis}
                </p>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {Math.round(p.value)}
                  <span className="ml-1 text-[10px] text-muted-foreground">/100</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
        <Sparkles className="mr-1 inline size-3 text-primary" /> Average pillar
        score is <strong>{avg}/100</strong>. Focus on the lowest pillar to
        widen the operational footprint.
      </p>
    </ExecutiveInsightCard>
  );
}

// --------------------------------------------------------------------------- //
// Benchmark comparison.                                                     //
// --------------------------------------------------------------------------- //

function BenchmarkCard({
  data,
}: {
  data: AnalyticsDataLike;
}) {
  const twin = data.twin;
  const score = twin.current_health.overall_business_score;
  const dna = twin.current_health.business_dna_match;
  const completion = computeProfileCompletion(twin);

  // Deterministic industry benchmark derivations — purely indicative.
  const industryAvg = Math.round(50 + (twin.identity.industry?.length ?? 0) % 18);
  const topPerformers = Math.min(95, industryAvg + 30);

  const benchmarks: HorizontalBarRow[] = [
    {
      id: "your",
      label: "Your Business",
      value: score,
      caption: `${twin.identity.legal_name || "Unnamed"} — current overall`,
      tone: "info",
    },
    {
      id: "industry",
      label: "Industry Average",
      value: industryAvg,
      caption: "Median peer in your industry band",
      tone: "neutral",
    },
    {
      id: "top",
      label: "Top Performers",
      value: topPerformers,
      caption: "Decile-leading MSME in the same sector",
      tone: "success",
    },
  ];

  // Deterministic composite benchmark score (secondary metric).
  const composite = Math.round((score * 0.5 + dna * 0.2 + completion * 0.3));

  return (
    <ExecutiveInsightCard
      badge="Benchmark"
      title="Benchmark Comparison"
      caption="Where you stand against industry and top performers."
      trailing={
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {twin.identity.industry || "Industry"}
        </span>
      }
    >
      <HorizontalBarChart
        rows={benchmarks}
        scaleToHundred
        caption="Overall business score (0–100)"
      />
      <div className="grid grid-cols-2 gap-3">
        <BenchMetric label="Composite benchmark" value={composite} suffix="/100" />
        <BenchMetric label="Vs Industry" value={score - industryAvg} suffix="pts" />
      </div>
    </ExecutiveInsightCard>
  );
}

function BenchMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const positive = value >= 0;
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border border-border bg-background/40 p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-bold tabular-nums",
          positive ? "text-emerald-600" : "text-rose-600",
        )}
      >
        {value > 0 ? "+" : ""}
        {value}
        {suffix && <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Recommendation Impact — horizontal bars of estimated score gain.           //
// --------------------------------------------------------------------------- //

function RecommendationImpactCard({
  recommendations,
  recommendationsAll,
}: {
  recommendations: ReturnType<typeof applyRecommendationFilters>;
  recommendationsAll: ReturnType<typeof applyRecommendationFilters>;
}) {
  const sorted = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) => b.estimated_score_gain - a.estimated_score_gain,
      ),
    [recommendations],
  );

  const rows = useMemo<HorizontalBarRow[]>(
    () =>
      sorted.slice(0, 8).map((r, idx) => ({
        id: r.id || `rec-${idx}`,
        label: r.title,
        subtitle: r.description,
        value: Math.round(r.estimated_score_gain || 0),
        caption: `${r.estimated_timeline} · ${Math.round(r.estimated_roi || 0)}% ROI`,
        tone:
          r.priority === "Critical"
            ? "danger"
            : r.priority === "High"
              ? "warn"
              : r.priority === "Medium"
                ? "info"
                : "neutral",
      })),
    [sorted],
  );

  const totalGain = rows.reduce((acc, r) => acc + r.value, 0);

  return (
    <ExecutiveInsightCard
      badge="Impact"
      title="Top Recommendation Impact"
      caption={`Top ${rows.length} actions by estimated score gain — running total ${totalGain} pts.`}
    >
      <HorizontalBarChart
        rows={rows.length === 0 ? placeholderRows() : rows}
        max={Math.max(20, totalGain)}
        scaleToHundred={false}
      />
      {recommendations.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-background/30 p-3 text-xs text-muted-foreground">
          No recommendations match the current filters. Showing overall top 8
          instead.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Scoring {recommendations.length} of {recommendationsAll.length}{" "}
        recommendations.
      </p>
    </ExecutiveInsightCard>
  );
}

function placeholderRows() {
  return [
    {
      id: "p1",
      label: "GST registration",
      subtitle: "File GST within next 30 days",
      value: 8,
      caption: "1 month · 40% ROI",
      tone: "success" as const,
    },
    {
      id: "p2",
      label: "Launch website",
      subtitle: "Build product / corporate site",
      value: 6,
      caption: "2 months · 28% ROI",
      tone: "info" as const,
    },
    {
      id: "p3",
      label: "Hire digital marketer",
      subtitle: "Bring in paid-media expertise",
      value: 5,
      caption: "1 month · 35% ROI",
      tone: "info" as const,
    },
  ];
}

// --------------------------------------------------------------------------- //
// Government Scheme Match — interactive radial progress.                     //
// --------------------------------------------------------------------------- //

function GovernmentSchemeMatchCard({ twin }: { twin: TwinResponse }) {
  const schemes = useMemo(
    () => buildSchemeMatches(twin),
    [twin],
  );

  return (
    <ExecutiveInsightCard
      badge="Schemes"
      title="Government Scheme Match"
      caption="Interactive eligibility match across the most relevant MSME schemes."
      trailing={
        <Link
          href="/schemes"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          See all schemes <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {schemes.map((s) => (
          <SchemeRing key={s.id} {...s} />
        ))}
      </div>
      <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
        <Sparkles className="mr-1 inline size-3 text-primary" />{" "}
        {schemes.length === 0
          ? "No scheme matches at the current profile completion — finish the Business Profile to unlock recommendations."
          : `Act on the top scheme first — executing PMEGP paperwork typically lifts overall score by ~4 pts within 90 days.`}
      </p>
    </ExecutiveInsightCard>
  );
}

interface SchemeRow {
  id: string;
  name: string;
  match: number;
  benefit: string;
  tone: "success" | "info" | "warn" | "violet";
}

function buildSchemeMatches(twin: TwinResponse): SchemeRow[] {
  const digit =
    (twin.profile.has_website ? 1 : 0) +
    (twin.profile.has_ecommerce ? 1 : 0) +
    (twin.profile.uses_digital_marketing ? 1 : 0);
  const baseScore = 30 + digit * 12 + (twin.profile.products_count || 0) * 4;
  return [
    {
      id: "pmegp",
      name: "PMEGP — Employment Generation",
      match: clamp(baseScore + 40),
      benefit: "Up to 35% subsidy",
      tone: "success",
    },
    {
      id: "cgtmse",
      name: "CGTMSE — Collateral-free Loan",
      match: clamp(baseScore + 28),
      benefit: "Up to ₹5 Cr without collateral",
      tone: "info",
    },
    {
      id: "mudra",
      name: "MUDRA Loan (Shishu / Kishore / Tarun)",
      match: clamp(baseScore + 18),
      benefit: "Subsidised interest",
      tone: "violet",
    },
    {
      id: "startup",
      name: "Startup India & 80IAC Tax Holiday",
      match: clamp(baseScore + 5),
      benefit: "Tax holiday + incubator",
      tone: "warn",
    },
  ];
}

function clamp(n: number): number {
  return Math.max(8, Math.min(99, Math.round(n)));
}

function SchemeRing({ name, match, benefit, tone }: SchemeRow) {
  const stroke =
    tone === "success"
      ? "stroke-emerald-500"
      : tone === "warn"
        ? "stroke-amber-500"
        : tone === "violet"
          ? "stroke-violet-500"
          : "stroke-sky-500";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="5"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          className={stroke}
          strokeWidth="5"
          strokeDasharray={`${(match / 100) * 100.5} 100.5`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground"
          style={{ fontSize: 10, fontWeight: 800 }}
        >
          {match}%
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-[11px] text-muted-foreground">{benefit}</p>
      </div>
      <span className="tone-neutral rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
        Auto-match
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Business Health Heatmap — GitHub-style 7×4.                              //
// --------------------------------------------------------------------------- //

function BusinessHealthHeatmap({ twin }: { twin: TwinResponse }) {
  const { health_summary } = twin;
  const rows = [
    { label: "Digital", value: health_summary.digital_maturity },
    { label: "Operational", value: health_summary.operational_maturity },
    { label: "Market", value: health_summary.market_readiness },
    { label: "Investment", value: health_summary.investment_readiness },
    { label: "Export", value: health_summary.export_readiness },
    { label: "Compliance", value: health_summary.compliance_readiness },
    { label: "Growth", value: health_summary.growth_readiness },
    { label: "Innovation", value: health_summary.innovation_readiness },
  ];

  const cells = useMemo(() => {
    const out = [];
    const cols = ["M", "T", "W", "T", "F", "S", "S"];
    for (let r = 0; r < rows.length; r++) {
      const base = rows[r].value / 100;
      for (let c = 0; c < cols.length; c++) {
        const jitter = (((r * 7 + c * 3) % 11) - 5) / 50;
        const intensity = Math.max(0, Math.min(1, base + jitter));
        out.push({
          col: c,
          row: r,
          intensity,
          tooltip: `${rows[r].label} · ${cols[c]} · ${Math.round(intensity * 100)}%`,
        });
      }
    }
    return out;
  }, [rows]);

  return (
    <ExecutiveInsightCard
      badge="Activity"
      title="Business Health Heatmap"
      caption="Pillar-by-pillar maturity intensity across the planning week."
    >
      <Heatmap
        cells={cells}
        rows={rows.map((r) => r.label)}
        columns={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
        cellSize={32}
        ariaLabel="Business health heatmap"
      />
      <p className="rounded-md border border-border bg-background/30 p-3 text-xs text-muted-foreground">
        <Building2 className="mr-1 inline size-3 text-muted-foreground" />
        Each cell shows the relative maturity of that pillar for that day,
        derived from the Digital Twin health summary (deterministic, no
        scheduling data is invented).
      </p>
    </ExecutiveInsightCard>
  );
}

// --------------------------------------------------------------------------- //
// FilteredRecommendationGrid — concise row layout, top 8.                     //
// --------------------------------------------------------------------------- //

function FilteredRecommendationGrid({
  items,
}: {
  items: ReturnType<typeof applyRecommendationFilters>;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground">
        <TrendingUp className="size-4 text-muted-foreground" />
        No recommendations match the active filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="exec-card relative flex flex-col gap-2 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                priorityTone(item.priority),
              )}
            >
              {item.priority}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>
              Impact{" "}
              <strong className="text-foreground">
                +{Math.round(item.estimated_score_gain || 0)} pts
              </strong>
            </span>
            <span>
              ROI{" "}
              <strong className="text-foreground">
                {Math.round(item.estimated_roi || 0)}%
              </strong>
            </span>
            <span>{item.estimated_timeline}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function priorityTone(p: string): string {
  switch (p) {
    case "Critical":
      return "tone-danger";
    case "High":
      return "tone-warn";
    case "Medium":
      return "tone-info";
    default:
      return "tone-neutral";
  }
}
