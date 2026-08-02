"use client";

/**
 * Section 1 — Business Snapshot.
 * Reads `twin.identity` + `twin.profile`. Renders the seven fields
 * named in the H5.1 brief (name, industry, location, age,
 * employees, products/services, markets) plus a "View full
 * business profile" link to /business. No fake values — every
 * line either comes from the twin payload or shows a 'Not
 * provided' placeholder.
 */

import React from "react";
import Link from "next/link";
import type { TwinResponse } from "@/types/analytics";
import { InsightChip } from "@/components/intelligence/InsightChip";

interface BusinessSnapshotProps {
  twin?: TwinResponse | null;
}

function fmtLocation(identity: TwinResponse["identity"]): string {
  const parts = [identity.city, identity.state_region, identity.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location not provided";
}

function businessAge(establishedYear: number | null | undefined): string {
  if (!establishedYear) return "Not provided";
  const now = new Date().getFullYear();
  const age = now - establishedYear;
  if (age <= 0) return `${establishedYear} (current year)`;
  if (age === 1) return "1 year";
  return `${age} years (est. ${establishedYear})`;
}

function productCount(identity: TwinResponse["identity"], profile: TwinResponse["profile"]): string {
  if (!profile.products_count) return "Not provided";
  const n = profile.products_count;
  return `${n} product${n === 1 ? "" : "s"}`;
}

function marketsLabel(twin: TwinResponse): string {
  const countries = twin.profile.export_countries || 0;
  const domestic = twin.identity.city || twin.identity.state_region;
  const parts: string[] = [];
  if (domestic) parts.push(`Domestic — ${domestic}`);
  if (countries > 0) parts.push(`Export — ${countries} country${countries === 1 ? "" : "s"}`);
  if (parts.length === 0) return "Markets not provided";
  return parts.join(" · ");
}

export const BusinessSnapshot: React.FC<BusinessSnapshotProps> = ({ twin }) => {
  if (!twin) return null;
  const identity = twin.identity;
  const profile = twin.profile;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Business name", value: identity.legal_name || "Not provided" },
    {
      label: "Industry",
      value: identity.sub_industry
        ? `${identity.industry} · ${identity.sub_industry}`
        : identity.industry || "Not provided",
    },
    { label: "Location", value: fmtLocation(identity) },
    { label: "Business age", value: businessAge(identity.established_year) },
    {
      label: "Employees",
      value:
        identity.employee_count != null && identity.employee_count > 0
          ? `${identity.employee_count} people`
          : "Not provided",
    },
    { label: "Products / services", value: productCount(identity, profile) },
    { label: "Markets", value: marketsLabel(twin) },
  ];

  return (
    <section
      aria-labelledby="twin-section-snapshot"
      className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Section 1
          </span>
          <h2 id="twin-section-snapshot" className="mt-0.5 text-lg font-bold text-card-foreground sm:text-xl">
            Business Snapshot
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who you are — at a glance.
          </p>
        </div>
        <Link
          href="/business"
          className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted"
        >
          View full business profile →
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {row.label}
            </div>
            <div className="mt-1 text-sm font-semibold text-card-foreground">{row.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.has_active_certification ? (
          <InsightChip label={`${profile.certifications_count} active certification${profile.certifications_count === 1 ? "" : "s"}`} variant="high" />
        ) : (
          <InsightChip label="No active certifications" variant="low" />
        )}
        {profile.has_website && <InsightChip label="Has website" variant="medium" />}
        {profile.has_ecommerce && <InsightChip label="E-commerce" variant="medium" />}
        {profile.has_iec_number && <InsightChip label="IEC registered" variant="high" />}
        {profile.uses_digital_marketing && <InsightChip label="Digital marketing on" variant="medium" />}
      </div>
    </section>
  );
};
