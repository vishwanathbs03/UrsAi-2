"use client";

import { ReportSection } from "../ReportSection";
import type { ReportSectionMeta } from "../sections";
import type { ReportsData } from "../use-reports-data";

const META: ReportSectionMeta = {
  key: "business-health",
  id: "report-business-health",
  badge: "Health",
  title: "Business Health",
  caption: "Maturity across the ten readiness dimensions.",
};

interface BusinessHealthSectionProps {
  data: ReportsData;
}

/**
 * Business Health — the ten health_summary dimensions plus
 * the overall twin health. Read directly from the Digital
 * Twin payload; no derivations.
 */
export function BusinessHealthSection({ data }: BusinessHealthSectionProps) {
  const h = data.twin.health_summary;
  const rows: { label: string; value: number }[] = [
    { label: "Overall health", value: h.overall_health },
    { label: "Business maturity", value: h.business_maturity },
    { label: "Digital maturity", value: h.digital_maturity },
    { label: "Operational maturity", value: h.operational_maturity },
    { label: "Market readiness", value: h.market_readiness },
    { label: "Investment readiness", value: h.investment_readiness },
    { label: "Export readiness", value: h.export_readiness },
    { label: "Compliance readiness", value: h.compliance_readiness },
    { label: "Growth readiness", value: h.growth_readiness },
    { label: "Innovation readiness", value: h.innovation_readiness },
    { label: "Sustainability readiness", value: h.sustainability_readiness },
  ];

  return (
    <ReportSection meta={META}>
      <p className="text-sm text-muted-foreground">
        Each dimension is scored 0–100 by the Digital Twin. Use this
        table to spot the dimensions dragging the overall number down.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="text-sm text-foreground">{r.label}</span>
            <span
              className={`text-sm font-semibold tabular-nums ${scoreTone(r.value)}`}
            >
              {r.value}
              <span className="text-xs text-muted-foreground"> / 100</span>
            </span>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function scoreTone(value: number): string {
  if (value >= 70) return "text-emerald-600";
  if (value >= 40) return "text-amber-600";
  return "text-rose-600";
}
