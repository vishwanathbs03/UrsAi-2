"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Landmark, Search, Filter, ExternalLink, CheckCircle, AlertCircle, HelpCircle, ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { schemesService, type SchemeItem } from "@/services/schemes-service";
import { cn } from "@/lib/utils";

export function SchemesView() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedScheme, setSelectedScheme] = useState<SchemeItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["government-schemes"],
    queryFn: () => schemesService.getSchemes(),
  });

  const allSchemes = useMemo(() => {
    if (!data?.schemes) return [];
    return [
      ...data.schemes.recommended,
      ...data.schemes.eligible,
      ...data.schemes.partially_eligible,
      ...data.schemes.not_eligible,
    ];
  }, [data]);

  const filteredSchemes = useMemo(() => {
    return allSchemes.filter((s) => {
      const matchQuery =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        categoryFilter === "all" || s.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchQuery && matchCategory;
    });
  }, [allSchemes, search, categoryFilter]);

  if (isLoading) {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-6">
          <DashboardSkeleton rows={2} />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardSkeleton rows={4} />
            <DashboardSkeleton rows={4} />
            <DashboardSkeleton rows={4} />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load Government Schemes"
          description={error instanceof Error ? error.message : "Failed to load scheme recommendations."}
          actionLabel="Try again"
          onAction={refetch}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-6">
        <DashboardCard
          badge="Discovery Engine"
          title="Government Schemes & Subsidies"
          caption="Discover central & state government MSME schemes tailored to your business profile."
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Landmark className="size-4 text-primary" aria-hidden="true" />
              <span>
                Found <strong className="text-foreground">{data?.total_schemes ?? 0}</strong> eligible scheme recommendations
              </span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search schemes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-1.5 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                <option value="financial">Financial</option>
                <option value="subsidy">Subsidy</option>
                <option value="credit">Credit Guarantee</option>
                <option value="technology">Technology</option>
              </select>
            </div>
          </div>
        </DashboardCard>

        {filteredSchemes.length === 0 ? (
          // P0.12 — distinguish "no schemes returned" from
          // "no matching scheme for the current filter".
          // Service error is already handled above via ErrorState.
          allSchemes.length === 0 ? (
            <EmptyState
              illustration="building"
              title="No schemes returned"
              description="The scheme engine returned no schemes for the current business profile. This may be a transient state or the profile may need more detail."
              actionLabel="Refresh"
              onAction={() => void refetch()}
            />
          ) : (
            <EmptyState
              illustration="building"
              title="No matching schemes for this filter"
              description="Schemes are available, but none match the current search or category filter. Try adjusting your criteria."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch("");
                setCategoryFilter("all");
              }}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSchemes.map((scheme) => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                onSelect={() => setSelectedScheme(scheme)}
              />
            ))}
          </div>
        )}

        {selectedScheme && (
          <SchemeDetailModal
            scheme={selectedScheme}
            onClose={() => setSelectedScheme(null)}
          />
        )}
      </div>
    </PageContainer>
  );
}

function SchemeCard({ scheme, onSelect }: { scheme: SchemeItem; onSelect: () => void }) {
  const statusColor =
    scheme.eligibility_status === "eligible"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : scheme.eligibility_status === "partiallyEligible"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-soft hover-lift transition-all">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider", statusColor)}>
            {scheme.eligibility_status === "eligible" && <CheckCircle className="size-3" />}
            {scheme.eligibility_status === "partiallyEligible" && <AlertCircle className="size-3" />}
            {scheme.eligibility_status}
          </span>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {scheme.matching_score}% Match
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground line-clamp-1">{scheme.name}</h3>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">{scheme.category}</p>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {scheme.description}
        </p>

        {scheme.benefits && scheme.benefits.length > 0 && (
          <div className="rounded-lg bg-secondary/40 p-2.5 text-xs">
            <span className="font-semibold text-foreground">Key Benefit: </span>
            <span className="text-muted-foreground">{scheme.benefits[0]}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-border/80">
        <Button variant="outline" size="sm" onClick={onSelect} className="w-full gap-1">
          View Details
          <ChevronRight className="size-3.5" />
        </Button>
        {scheme.application_link && (
          <Button variant="ghost" size="icon" asChild title="Official Website">
            <a href={scheme.application_link} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function SchemeDetailModal({ scheme, onClose }: { scheme: SchemeItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-page-fade">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{scheme.category}</span>
            <h2 className="text-xl font-bold text-foreground mt-1">{scheme.name}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="flex flex-col gap-4 text-sm text-foreground">
          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
            <p className="text-muted-foreground leading-relaxed">{scheme.description}</p>
          </div>

          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Eligibility Reason</h4>
            <p className="text-muted-foreground leading-relaxed">{scheme.eligibility_reason}</p>
          </div>

          {scheme.benefits && scheme.benefits.length > 0 && (
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Key Benefits</h4>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {scheme.benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {scheme.documents_required && scheme.documents_required.length > 0 && (
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Required Documents</h4>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {scheme.documents_required.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          )}

          {scheme.application_steps && scheme.application_steps.length > 0 && (
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Application Steps</h4>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                {scheme.application_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4 mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {scheme.application_link && (
            <Button asChild className="gap-2">
              <a href={scheme.application_link} target="_blank" rel="noreferrer">
                Apply on Official Portal
                <ExternalLink className="size-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
