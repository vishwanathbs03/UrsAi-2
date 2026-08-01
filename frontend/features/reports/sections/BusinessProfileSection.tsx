"use client";

import { Building2, Globe2, MapPin, Sparkles } from "lucide-react";
import { ReportSection } from "../ReportSection";
import { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "business-profile",
  id: "report-business-profile",
  badge: "Profile",
  title: "Business Profile",
  caption: "Identity and operational footprint from the Digital Twin.",
};

interface BusinessProfileSectionProps {
  data: ReportsData;
}

/**
 * Business Profile section — surfaces the identity block plus
 * the operational footprint (products, certifications, exports,
 * digital channels) from the Digital Twin.
 */
export function BusinessProfileSection({ data }: BusinessProfileSectionProps) {
  const { identity, profile } = data.twin;
  return (
    <ReportSection meta={META}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Identity
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <p className="text-base font-semibold text-foreground">
                {identity.legal_name}
              </p>
              {identity.trade_name && (
                <p className="text-xs text-muted-foreground">
                  Trading as {identity.trade_name}
                </p>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <DefinitionRow label="Industry" value={identity.industry} />
            {identity.sub_industry && (
              <DefinitionRow label="Sub-industry" value={identity.sub_industry} />
            )}
            {identity.business_type && (
              <DefinitionRow label="Type" value={identity.business_type} />
            )}
            <DefinitionRow
              label="Established"
              value={String(identity.established_year)}
            />
            <DefinitionRow
              label="Employees"
              value={identity.employee_count.toLocaleString()}
            />
            <DefinitionRow
              label="Annual revenue"
              value={`${identity.annual_revenue.toLocaleString()} ${identity.revenue_currency}`}
            />
            {identity.country && (
              <DefinitionRow
                label="Location"
                value={[identity.city, identity.state_region, identity.country]
                  .filter(Boolean)
                  .join(", ")}
              />
            )}
          </dl>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Operational footprint
          </p>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            <FootprintItem
              icon={<Sparkles className="size-3.5" aria-hidden="true" />}
              label="Products"
              value={profile.products_count}
            />
            <FootprintItem
              icon={<Sparkles className="size-3.5" aria-hidden="true" />}
              label="Certifications"
              value={profile.certifications_count}
              hint={
                profile.has_active_certification ? "Active" : "None active"
              }
            />
            <FootprintItem
              icon={<Globe2 className="size-3.5" aria-hidden="true" />}
              label="Export countries"
              value={profile.export_countries}
            />
            <FootprintItem
              icon={<MapPin className="size-3.5" aria-hidden="true" />}
              label="Goals logged"
              value={profile.goals_count}
            />
            <FootprintItem
              icon={<Globe2 className="size-3.5" aria-hidden="true" />}
              label="Social channels"
              value={profile.social_channel_count}
            />
            <FootprintItem
              icon={<Sparkles className="size-3.5" aria-hidden="true" />}
              label="Challenges logged"
              value={profile.challenges_count}
            />
          </ul>
          <p className="text-xs text-muted-foreground">
            {identity.is_completed
              ? "Business profile is complete."
              : "Business profile is in progress."}
          </p>
        </div>
      </div>
    </ReportSection>
  );
}

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </>
  );
}

function FootprintItem({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border bg-card p-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex flex-col">
        <span className="text-foreground">
          <span className="text-sm font-semibold tabular-nums">
            {value.toLocaleString()}
          </span>{" "}
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
    </li>
  );
}
