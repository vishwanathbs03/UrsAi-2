"use client";

import React, { useMemo } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/70 dark:bg-muted/40", className)}
      aria-hidden="true"
    />
  );
}

export interface AISummaryCardProps {
  summary?: string;
  kpis?: {
    businessName?: string | null;
    business_name?: string | null;
    industry?: string | null;
    employees?: number;
    products?: number;
    services?: number;
    locations?: number;
    yearsInBusiness?: number;
    years_in_business?: number;
    profileCompletion?: number;
    profile_completion?: number;
    [key: string]: any;
  } | null;
  healthScore?: number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export interface RuleInsight {
  type: "positive" | "warning" | "info";
  text: string;
}

export function AISummaryCard({
  summary,
  kpis,
  healthScore = 85,
  isLoading = false,
  isError = false,
  errorMessage,
}: AISummaryCardProps) {
  const { generatedSummary, insights } = useMemo(() => {
    if (!kpis && !summary) {
      return { generatedSummary: "", insights: [] };
    }

    const k = kpis || {};
    const name = k.businessName || k.business_name || "The business";
    const industry = k.industry || "the industry";
    const emp = k.employees ?? 0;
    const prods = k.products ?? 0;
    const servs = k.services ?? 0;
    const locs = k.locations ?? 0;
    const years = k.yearsInBusiness ?? k.years_in_business ?? 0;
    const completion = k.profileCompletion ?? k.profile_completion ?? 0;

    const paragraph =
      summary ||
      `${name} operates in ${industry}${
        years > 0 ? ` with over ${years} years of operating history` : ""
      }. ` +
        `The company maintains a workforce of ${emp} employees across ${locs || 1} market location(s) ` +
        `and offers ${prods} product(s) and ${servs} service(s). ` +
        `Digital twin health score is currently evaluated at ${healthScore}/100.`;

    const ruleList: RuleInsight[] = [];

    if (completion >= 80) {
      ruleList.push({
        type: "positive",
        text: `High profile completeness (${completion}%) ensures accurate Digital Twin simulation models.`,
      });
    } else {
      ruleList.push({
        type: "warning",
        text: `Profile is ${completion}% complete. Fill missing details (digital presence, certifications) to improve accuracy.`,
      });
    }

    if (emp > 10) {
      ruleList.push({
        type: "positive",
        text: `Established workforce of ${emp} employees supports operational stability and capacity expansion.`,
      });
    } else if (emp > 0) {
      ruleList.push({
        type: "info",
        text: `Lean workforce of ${emp} employee(s). Consider automation tools to scale throughput.`,
      });
    }

    if (prods > 0 || servs > 0) {
      ruleList.push({
        type: "positive",
        text: `Active portfolio of ${prods} product(s) and ${servs} service(s) driving commercial reach.`,
      });
    } else {
      ruleList.push({
        type: "warning",
        text: "No products or services listed. Add key offerings to enhance market intelligence scores.",
      });
    }

    if (locs > 1) {
      ruleList.push({
        type: "positive",
        text: `Geographic presence spanning ${locs} regional / international export markets.`,
      });
    }

    return { generatedSummary: paragraph, insights: ruleList };
  }, [kpis, summary, healthScore]);

  if (isLoading) {
    return (
      <DashboardCard
        badge="AI Summary"
        title="Executive Brief"
        caption="Generating rule-based intelligence summary..."
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </DashboardCard>
    );
  }

  if (isError) {
    return (
      <DashboardCard
        badge="AI Summary"
        title="Executive Brief"
        caption="Rule-based decision intelligence."
      >
        <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <p>{errorMessage || "Failed to generate AI summary for this dashboard."}</p>
        </div>
      </DashboardCard>
    );
  }

  if (!kpis && !summary) {
    return (
      <DashboardCard
        badge="AI Summary"
        title="Executive Brief"
        caption="Rule-based decision intelligence."
      >
        <EmptyState
          illustration="inbox"
          title="No summary available"
          description="Complete your business profile to surface rule-based executive insights."
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      badge="AI Summary"
      title="Executive Brief"
      caption="Rule-based decision intelligence derived from your current KPIs."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-foreground">{generatedSummary}</p>
        </div>

        {insights.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Rule Takeaways
            </span>
            <div className="flex flex-col gap-2">
              {insights.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs leading-normal text-muted-foreground"
                >
                  {item.type === "positive" && (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  )}
                  {item.type === "warning" && (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  )}
                  {item.type === "info" && (
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                  )}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
