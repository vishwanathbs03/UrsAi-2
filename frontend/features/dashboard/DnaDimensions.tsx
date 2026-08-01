/**
 * DnaDimensions — the 6-dimension Business DNA visualization.
 *
 *   1. Digital Maturity
 *   2. Financial Strength
 *   3. Market Presence
 *   4. Export Readiness
 *   5. Operational Efficiency
 *   6. Innovation Index
 *
 * Data source
 * -----------
 * The Business DNA endpoint returns a `secondary_traits` array with
 * per-trait `strength` values. Three of the six requested dimensions
 * have a direct mapping in the trait list; the other three do not
 * exist on the endpoint and are filled with **deterministic demo
 * values** derived from the archetype match score and a stable
 * per-dimension offset (so the values do not jitter on re-render).
 *
 * Each dimension that was filled with a demo value gets a small
 * amber "Demo" pill so the hackathon demo is honest.
 *
 * Visual
 * ------
 * Six `CircularScore` rings, animated from 0 to the value on first
 * paint. Existing dashboard tone helpers are used for the ring
 * colour so the visualisation feels native.
 */

"use client";

import { useMemo } from "react";
import {
  Building2,
  DollarSign,
  Globe,
  Lightbulb,
  Settings,
  Wifi,
} from "lucide-react";
import { CircularScore } from "@/components/dashboard/CircularScore";
import { cn } from "@/lib/utils";
import type { DnaResponse, DnaSecondaryTrait } from "@/types/dashboard";

interface DnaDimensionsProps {
  dna: DnaResponse | null;
}

// --------------------------------------------------------------------------- //
// Dimension definitions
// --------------------------------------------------------------------------- //

interface DimensionDef {
  key: DnaKey;
  label: string;
  /** Trait key on the DNA endpoint that maps to this dimension. */
  traitKey: string | null;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /** Deterministic fallback offset (0..30) when the trait is missing. */
  demoOffset: number;
}

type DnaKey =
  | "digital_maturity"
  | "financial_strength"
  | "market_presence"
  | "export_readiness"
  | "operational_efficiency"
  | "innovation_index";

const DIMENSIONS: DimensionDef[] = [
  { key: "digital_maturity",        label: "Digital Maturity",        traitKey: "digitally_active", icon: Wifi,       demoOffset: 8  },
  { key: "financial_strength",      label: "Financial Strength",      traitKey: null,               icon: DollarSign, demoOffset: 18 },
  { key: "market_presence",         label: "Market Presence",         traitKey: null,               icon: Building2,  demoOffset: 12 },
  { key: "export_readiness",        label: "Export Readiness",        traitKey: "export_ready",     icon: Globe,      demoOffset: 6  },
  { key: "operational_efficiency",  label: "Operational Efficiency",  traitKey: null,               icon: Settings,   demoOffset: 22 },
  { key: "innovation_index",        label: "Innovation Index",        traitKey: null,               icon: Lightbulb,  demoOffset: 14 },
];

// --------------------------------------------------------------------------- //
// Top-level component
// --------------------------------------------------------------------------- //

export function DnaDimensions({ dna }: DnaDimensionsProps) {
  const dimensions = useMemo(
    () => buildDimensions(dna),
    [dna],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Business DNA — Six Dimensions
        </h4>
        <DemoPill
          anyDemo={dimensions.some((d) => d.isDemo)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {dimensions.map((d) => (
          <DimensionTile key={d.def.key} dimension={d} />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// One dimension tile
// --------------------------------------------------------------------------- //

interface Dimension {
  def: DimensionDef;
  value: number;
  band: "low" | "medium" | "high";
  isDemo: boolean;
  /** Short note for the user (rationale or explanation). */
  note: string;
}

function DimensionTile({ dimension }: { dimension: Dimension }) {
  const { def, value, band, isDemo, note } = dimension;
  const Icon = def.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" aria-hidden="true" />
        {def.label}
        {isDemo && <DemoPill compact />}
      </div>
      <CircularScore
        value={value}
        size={84}
        thickness={7}
        caption={`${band}`}
        fillClassName={ringClass(band)}
        ariaLabel={`${def.label} ${Math.round(value)} out of 100`}
      />
      <p className="line-clamp-2 text-center text-[11px] leading-snug text-muted-foreground">
        {note}
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

function buildDimensions(dna: DnaResponse | null): Dimension[] {
  const traits = (dna?.dna?.secondary_traits ?? []) as DnaSecondaryTrait[];
  const matchScore = dna?.dna?.archetype?.match_score ?? 0;

  return DIMENSIONS.map((def) => {
    const trait = traits.find((t) => t.key === def.traitKey);
    if (trait && typeof trait.strength === "number") {
      const value = clamp(trait.strength, 0, 100);
      return {
        def,
        value,
        band: bandFor(value),
        isDemo: false,
        note: trait.present
          ? `Detected: ${trait.title}.`
          : `Trait present but below the present threshold (${trait.title}).`,
      };
    }
    // Deterministic demo: match score, plus a stable per-dimension
    // offset, clamped 0..100. The seed is the dimension key + match
    // score so the value never changes between renders for the same
    // DNA response, but does change when the user re-runs the
    // analysis (because match_score changes).
    const value = clamp(matchScore * 0.6 + def.demoOffset, 0, 100);
    return {
      def,
      value,
      band: bandFor(value),
      isDemo: true,
      note: "Deterministic demo — the DNA endpoint does not yet report this dimension.",
    };
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFor(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function ringClass(band: "low" | "medium" | "high"): string {
  if (band === "high") return "stroke-emerald-500";
  if (band === "medium") return "stroke-amber-500";
  return "stroke-rose-500";
}

function DemoPill({
  compact = false,
  anyDemo = false,
}: {
  compact?: boolean;
  anyDemo?: boolean;
}) {
  if (!anyDemo && !compact) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 font-medium uppercase tracking-wider text-amber-700",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
      )}
      title={
        compact
          ? "Deterministic demo value"
          : "Some dimensions below are deterministic demo values — the DNA endpoint does not yet report them."
      }
    >
      Demo
    </span>
  );
}
