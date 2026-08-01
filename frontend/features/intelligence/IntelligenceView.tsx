"use client";

import React from "react";
import { useIntelligence } from "@/hooks/useIntelligence";
import { BusinessDNACard } from "@/components/intelligence/BusinessDNACard";
import { SWOTCard } from "@/components/intelligence/SWOTCard";
import { ReadinessCard } from "@/components/intelligence/ReadinessCard";
import { BenchmarkCard } from "@/components/intelligence/BenchmarkCard";
import { OpportunityCard } from "@/components/intelligence/OpportunityCard";

export const IntelligenceView: React.FC = () => {
  const { data, isLoading, isError, error, refetch } = useIntelligence();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-8 w-64 rounded bg-muted/60" />
        <div className="h-4 w-96 rounded bg-muted/40" />
        <div className="grid grid-cols-1 gap-6">
          <div className="h-64 rounded-xl bg-card border border-border/50 p-6" />
          <div className="h-80 rounded-xl bg-card border border-border/50 p-6" />
          <div className="h-64 rounded-xl bg-card border border-border/50 p-6" />
        </div>
      </div>
    );
  }

  if (isError) {
    const is404 = error?.message?.includes("404") || (error as any)?.status === 404;

    if (is404) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center bg-card">
          <div className="rounded-full bg-muted p-4 text-muted-foreground">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-bold text-card-foreground">No Business Profile Found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">
            Please complete your business profile to generate your Business DNA, SWOT matrix, readiness scores, and industry benchmarks.
          </p>
          <a
            href="/business"
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
          >
            Complete Profile
          </a>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
        <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">Failed to Load Business Intelligence</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error?.message || "An unexpected error occurred."}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Business Intelligence Engine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deterministic 360° analytics, DNA classification, SWOT matrix, and growth opportunities.
        </p>
      </div>

      {/* 1. Business DNA Card */}
      <BusinessDNACard dna={data.dna} />

      {/* 2. Readiness Card */}
      <ReadinessCard readiness={data.readiness} />

      {/* 3. Industry Benchmark Card */}
      <BenchmarkCard benchmark={data.benchmark} />

      {/* 4. SWOT Card */}
      <SWOTCard swot={data.swot} />

      {/* 5. Opportunity List Card */}
      <OpportunityCard report={data.opportunities} />
    </div>
  );
};
