"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "./LevelBadge";
import { confidenceToTone, levelToTone, scoreTone } from "./tones";
import type { DnaResponse } from "@/types/dashboard";

interface DnaCardProps {
  dna: DnaResponse | null;
}

/**
 * Business DNA — archetype + secondary traits chips. The
 * archetype is the headline; the chips are the secondary
 * traits the DNA engine detected.
 *
 * Sprint 4: adds the DNA confidence badge (top-right) and
 * a "Confidence rationale" expansion so the user can see
 * why the engine is / isn't sure about the archetype.
 */
export function DnaCard({ dna }: DnaCardProps) {
  const body = dna?.dna;
  const archetype = body?.archetype;
  const traits = body?.secondary_traits ?? [];
  const present = traits.filter((t) => t.present);
  const confidence = body?.confidence;
  const rationale = body?.confidence_rationale ?? [];
  const conf = confidenceToTone(confidence ?? NaN);

  return (
    <DashboardCard
      badge="DNA"
      title={archetype?.title ?? "Awaiting analysis"}
      caption={
        archetype
          ? `Match ${archetype.match_score} / 100 — the engine's best read of your business identity.`
          : "The DNA engine has not produced an archetype yet."
      }
      trailing={
        archetype ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${conf.tone}`}
            aria-label={`DNA confidence: ${conf.label} (${Math.round(confidence ?? 0)}%)`}
            role="status"
          >
            <AnimatedCounter
              value={Math.round(confidence ?? 0)}
              suffix="%"
              className="normal-case tracking-normal"
              durationMs={500}
            />
            {conf.label}
          </span>
        ) : undefined
      }
    >
      {archetype && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Archetype</span>
          <span className="font-mono text-xs text-foreground">{archetype.key}</span>
          <LevelBadge
            level={`${archetype.match_score}`}
            tone={levelToTone(
              archetype.match_score >= 70
                ? "high"
                : archetype.match_score >= 40
                ? "medium"
                : "low",
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Secondary traits ({present.length}/{traits.length})
        </p>
        {present.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No secondary traits detected — the profile is in the catch-all Foundation Builder state.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {present.map((t) => (
              <li
                key={t.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground"
              >
                <span className={`size-1.5 rounded-full ${scoreTone("High")}`} />
                {t.title}
                <span className="text-muted-foreground">{t.strength}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {archetype && rationale.length > 0 && (
        <details className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">
            Why this confidence?
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {rationale.map((line, idx) => (
              <li key={idx} className="leading-snug">
                • {line}
              </li>
            ))}
          </ul>
        </details>
      )}
    </DashboardCard>
  );
}
