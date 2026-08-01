/**
 * BusinessOverview — read-only display of the authenticated user's
 * Business Digital Twin.
 *
 * Reuses the same `loading / no-business / error / ready` state machine
 * every other analytics surface in the app uses, so the view can be
 * dropped into any page and behave identically.
 *
 * Sections (in the order they appear in `app/schemas/business.py`):
 *   1. Basic             (legal_name, industry, established_year, …)
 *   2. Capacity          (production capacity, utilisation, monthly volume)
 *   3. Products          (list of products with name, category, price, export flag)
 *   4. Digital Presence  (website, social channels, e-commerce / marketing flags)
 *   5. Certifications    (name, issuing body, issued / expiry dates)
 *   6. Goals             (title, priority, timeframe, target date)
 *   7. Challenges        (title, severity, category)
 *
 * Above the sections: a Profile completeness card with the
 * `meta.profile_completion` percentage, the `meta.profile_status`
 * pill, and a list of `completeness.missing` fields the user can
 * still fill in. The "Edit" button is a callback prop so the parent
 * (the route) decides where editing happens.
 *
 * The component is read-only. It does NOT mutate the Business row,
 * does NOT touch routing, and does NOT import businessService directly —
 * all data flows through `useBusinessQuery()`.
 */

"use client";

import {
  AlertOctagon,
  Building2,
  Calendar,
  CheckCircle2,
  CircleAlert,
  Edit3,
  Factory,
  Globe2,
  Lightbulb,
  ListChecks,
  Package,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { ApiError } from "@/services/api-client";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { useBusinessQuery } from "./use-business-data";
import type {
  BusinessOut,
  ProfileCompleteness,
  ProfileStatus,
} from "@/types/business";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------- //
// Public component
// --------------------------------------------------------------------------- //

interface BusinessOverviewProps {
  /** Fired when the user clicks the "Edit" button. */
  onEdit?: () => void;
}

export function BusinessOverview({ onEdit }: BusinessOverviewProps) {
  const { data, error, isLoading, isFetching, refetch } = useBusinessQuery();

  if (isLoading) {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-4">
          <DashboardSkeleton rows={3} />
          <DashboardSkeleton rows={5} />
          <DashboardSkeleton rows={4} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <PageContainer width="wide">
          <EmptyState
            illustration="building"
            title="No business profile yet"
            description="Set up your business profile to see it here."
            actionLabel="Create business profile"
            onAction={onEdit}
          />
        </PageContainer>
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not load the business profile.";
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load the business profile"
          description={message}
          actionLabel="Try again"
          onAction={() => refetch()}
        />
      </PageContainer>
    );
  }

  if (!data) {
    return null;
  }

  const { business, completeness, meta } = data;
  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <OverviewHeader
          business={business}
          meta={meta}
          completeness={completeness}
          isFetching={isFetching}
          onEdit={onEdit}
        />

        <BasicCard business={business} />
        <CapacityCard business={business} />
        <ProductsCard products={business.products} />
        <PresenceCard
          website={business.digital_presence?.website_url ?? null}
          linkedin={business.digital_presence?.linkedin_url ?? null}
          facebook={business.digital_presence?.facebook_url ?? null}
          instagram={business.digital_presence?.instagram_url ?? null}
          twitter={business.digital_presence?.twitter_url ?? null}
          youtube={business.digital_presence?.youtube_url ?? null}
          hasEcommerce={business.digital_presence?.has_ecommerce ?? false}
          ecommercePlatform={business.digital_presence?.ecommerce_platform ?? null}
          usesDigitalMarketing={business.digital_presence?.uses_digital_marketing ?? false}
          usesCloudSystems={business.digital_presence?.uses_cloud_systems ?? false}
        />
        <CertificationsCard certs={business.certifications} />
        <GoalsCard goals={business.goals} />
        <ChallengesCard challenges={business.challenges} />
      </div>
    </PageContainer>
  );
}

// --------------------------------------------------------------------------- //
// Header — title, status pill, completeness bar, Edit button
// --------------------------------------------------------------------------- //

function OverviewHeader({
  business,
  meta,
  completeness,
  isFetching,
  onEdit,
}: {
  business: BusinessOut;
  meta: { profile_completion: number; profile_status: ProfileStatus; last_updated: string };
  completeness: ProfileCompleteness;
  isFetching: boolean;
  onEdit?: () => void;
}) {
  const statusTone = profileStatusTone(meta.profile_status);
  const fillTone = profileFillTone(meta.profile_completion);
  return (
    <DashboardCard
      badge="Business"
      title={business.legal_name}
      caption={`${business.industry}${business.country ? " — " + business.country : ""}`}
      trailing={
        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Refreshing…
            </span>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit3 className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              statusTone,
            )}
          >
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {meta.profile_status.replace("_", " ")}
          </span>
          <span className="text-xs text-muted-foreground">
            {completeness.completed_fields} of {completeness.total_fields} fields filled
          </span>
          <span className="text-xs text-muted-foreground">
            · Last updated {formatTimestamp(meta.last_updated)}
          </span>
        </div>
        <ProgressBar
          value={meta.profile_completion}
          label="Profile completeness"
          hint={`${meta.profile_completion}%`}
          fillClassName={fillTone}
          ariaLabel="Profile completeness percentage"
        />
        {completeness.missing.length > 0 && (
          <details className="rounded-md border border-border bg-secondary/30 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              {completeness.missing.length} field
              {completeness.missing.length === 1 ? "" : "s"} still missing
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {completeness.missing.map((m) => (
                <li key={`${m.section}.${m.field}`} className="flex items-center gap-2">
                  <ListChecks className="size-3" aria-hidden="true" />
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span>· {m.section}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 1 — Basic
// --------------------------------------------------------------------------- //

function BasicCard({ business: b }: { business: BusinessOut }) {
  return (
    <DashboardCard
      badge="Step 1"
      title="Basic information"
      icon={<Building2 className="size-4" aria-hidden="true" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Legal name" value={b.legal_name} />
        <Field label="Trade name" value={b.trade_name} />
        <Field label="Industry" value={b.industry} />
        <Field label="Sub-industry" value={b.sub_industry} />
        <Field label="Business type" value={b.business_type} />
        <Field label="Established year" value={String(b.established_year)} />
        <Field label="Employee count" value={String(b.employee_count)} />
        <Field
          label="Annual revenue"
          value={`${b.annual_revenue} ${b.revenue_currency}`}
        />
        <Field label="Country" value={b.country} />
        <Field label="State / region" value={b.state_region} />
        <Field label="City" value={b.city} />
        <Field label="Created" value={formatTimestamp(b.created_at)} />
        <Field label="Updated" value={formatTimestamp(b.updated_at)} className="md:col-span-2" />
        {b.description && (
          <div className="md:col-span-2">
            <Field label="Description" value={b.description} multiline />
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 2 — Capacity
// --------------------------------------------------------------------------- //

function CapacityCard({ business: b }: { business: BusinessOut }) {
  const hasAny =
    b.production_capacity !== null ||
    b.production_capacity_unit !== null ||
    b.capacity_utilization_pct !== null ||
    b.monthly_production_units !== null;
  return (
    <DashboardCard
      badge="Step 2"
      title="Capacity"
      icon={<Factory className="size-4" aria-hidden="true" />}
    >
      {hasAny ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Production capacity"
            value={
              b.production_capacity
                ? `${b.production_capacity}${b.production_capacity_unit ? " " + b.production_capacity_unit : ""}`
                : null
            }
          />
          <Field
            label="Capacity unit"
            value={b.production_capacity_unit}
          />
          <Field
            label="Utilisation"
            value={b.capacity_utilization_pct !== null ? `${b.capacity_utilization_pct}%` : null}
          />
          <Field
            label="Monthly production (units)"
            value={b.monthly_production_units !== null ? String(b.monthly_production_units) : null}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No capacity data yet.</p>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 3 — Products
// --------------------------------------------------------------------------- //

function ProductsCard({ products }: { products: BusinessOut["products"] }) {
  return (
    <DashboardCard
      badge="Step 3"
      title="Products"
      icon={<Package className="size-4" aria-hidden="true" />}
      caption={`${products.length} product${products.length === 1 ? "" : "s"}`}
    >
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                {p.category && (
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {p.hs_code && (
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px]">
                    HS {p.hs_code}
                  </span>
                )}
                {p.unit_price !== null && (
                  <span>
                    {p.unit_price} {p.currency}
                  </span>
                )}
                {p.monthly_volume !== null && <span>· {p.monthly_volume} / mo</span>}
                {p.is_exported && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700">
                    <TrendingUp className="size-3" aria-hidden="true" />
                    Exported
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 4 — Digital Presence
// --------------------------------------------------------------------------- //

interface PresenceCardProps {
  website: string | null;
  linkedin: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  hasEcommerce: boolean;
  ecommercePlatform: string | null;
  usesDigitalMarketing: boolean;
  usesCloudSystems: boolean;
}

function PresenceCard(p: PresenceCardProps) {
  const hasAny =
    p.website || p.linkedin || p.facebook || p.instagram || p.twitter || p.youtube ||
    p.hasEcommerce || p.usesDigitalMarketing || p.usesCloudSystems;
  return (
    <DashboardCard
      badge="Step 4"
      title="Digital presence"
      icon={<Globe2 className="size-4" aria-hidden="true" />}
    >
      {hasAny ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Website" value={p.website} link />
          <Field label="LinkedIn" value={p.linkedin} link />
          <Field label="Facebook" value={p.facebook} link />
          <Field label="Instagram" value={p.instagram} link />
          <Field label="X / Twitter" value={p.twitter} link />
          <Field label="YouTube" value={p.youtube} link />
          <Field
            label="E-commerce"
            value={p.hasEcommerce ? (p.ecommercePlatform ? `Yes — ${p.ecommercePlatform}` : "Yes") : null}
          />
          <Field label="Digital marketing" value={p.usesDigitalMarketing ? "Yes" : null} />
          <Field label="Cloud systems" value={p.usesCloudSystems ? "Yes" : null} className="md:col-span-2" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No digital presence data yet.</p>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 5 — Certifications
// --------------------------------------------------------------------------- //

function CertificationsCard({ certs }: { certs: BusinessOut["certifications"] }) {
  return (
    <DashboardCard
      badge="Step 5"
      title="Certifications"
      icon={<ShieldCheck className="size-4" aria-hidden="true" />}
      caption={`${certs.length} certification${certs.length === 1 ? "" : "s"}`}
    >
      {certs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No certifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {certs.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-0.5 rounded-md border border-border bg-secondary/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                {c.issuing_body && (
                  <span className="text-xs text-muted-foreground">{c.issuing_body}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {c.issued_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" aria-hidden="true" />
                    Issued {c.issued_date}
                  </span>
                )}
                {c.expiry_date && <span>· Expires {c.expiry_date}</span>}
                {c.certificate_number && (
                  <span className="font-mono text-[10px]">{c.certificate_number}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 6 — Goals
// --------------------------------------------------------------------------- //

function GoalsCard({ goals }: { goals: BusinessOut["goals"] }) {
  return (
    <DashboardCard
      badge="Step 7"
      title="Business goals"
      icon={<Target className="size-4" aria-hidden="true" />}
      caption={`${goals.length} goal${goals.length === 1 ? "" : "s"}`}
    >
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((g) => (
            <li
              key={g.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{g.title}</span>
                <PriorityPill priority={g.priority} />
              </div>
              {g.description && (
                <p className="text-xs text-muted-foreground">{g.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {g.timeframe && <span>· {g.timeframe}</span>}
                {g.target_date && <span>· Target {g.target_date}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Section 7 — Challenges
// --------------------------------------------------------------------------- //

function ChallengesCard({ challenges }: { challenges: BusinessOut["challenges"] }) {
  return (
    <DashboardCard
      badge="Step 8"
      title="Business challenges"
      icon={<CircleAlert className="size-4" aria-hidden="true" />}
      caption={`${challenges.length} challenge${challenges.length === 1 ? "" : "s"}`}
    >
      {challenges.length === 0 ? (
        <p className="text-sm text-muted-foreground">No challenges yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {challenges.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-secondary/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{c.title}</span>
                <SeverityPill severity={c.severity} />
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground">{c.description}</p>
              )}
              {c.category && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.category}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// --------------------------------------------------------------------------- //
// Small shared pieces
// --------------------------------------------------------------------------- //

function Field({
  label,
  value,
  multiline,
  link,
  className,
}: {
  label: string;
  value: string | number | null | undefined;
  multiline?: boolean;
  link?: boolean;
  className?: string;
}) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  const isMissing = display === "—";
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {link && !isMissing ? (
        <a
          href={display}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-medium text-primary hover:underline"
        >
          {display}
        </a>
      ) : multiline ? (
        <p className={cn("whitespace-pre-line text-sm", isMissing ? "text-muted-foreground" : "text-foreground")}>
          {display}
        </p>
      ) : (
        <span className={cn("text-sm", isMissing ? "text-muted-foreground" : "text-foreground")}>
          {display}
        </span>
      )}
    </div>
  );
}

function PriorityPill({ priority }: { priority: "low" | "medium" | "high" }) {
  const tone =
    priority === "high"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
      : priority === "medium"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", tone)}>
      {priority}
    </span>
  );
}

function SeverityPill({ severity }: { severity: "low" | "medium" | "high" | "critical" }) {
  const tone =
    severity === "critical" || severity === "high"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
      : severity === "medium"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", tone)}>
      {severity === "critical" || severity === "high" ? (
        <AlertOctagon className="size-3" aria-hidden="true" />
      ) : (
        <Lightbulb className="size-3" aria-hidden="true" />
      )}
      {severity}
    </span>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function profileStatusTone(status: ProfileStatus): string {
  if (status === "complete")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "in_progress")
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-border bg-secondary text-muted-foreground";
}

function profileFillTone(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-primary";
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
