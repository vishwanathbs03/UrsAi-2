"use client";

import { CheckCircle2, Clock, Gauge, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DecisionCardPayload } from "./types";

/**
 * Premium McKinsey-style decision card.
 *
 * Shows a single binary question with a deterministic verdict,
 * the reasoning, the risks, the ROI, the timeline, and a
 * confidence meter.
 *
 * The card collapses the answer to a single chip + headline at
 * glance; the body opens on demand via a chevron.
 */
export function DecisionSupportCard({ payload }: { payload: DecisionCardPayload }) {
  const verdictClass = verdictClasses(payload.verdictTone);

  return (
    <div
      className={cn(
        "exec-card relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all",
        verdictClass.frame,
      )}
      role="region"
      aria-label={`Decision card: ${payload.question}`}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1",
          verdictClass.accent,
        )}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Decision support
          </p>
          <h3 className="font-display text-2xl font-semibold leading-tight">
            {payload.question}
          </h3>
          <p className="max-w-prose text-sm text-muted-foreground">
            {payload.headline}
          </p>
        </div>
        <VerdictPill
          verdict={payload.verdict}
          tone={payload.verdictTone}
          className={cn(
            "shrink-0 px-4 py-2 text-base font-semibold tracking-wide",
          )}
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <CardRow icon={Gauge} title="Why" value={payload.why} />
        <CardRow icon={Clock} title="Timeline" value={payload.timeline} />
        <CardRow icon={ShieldAlert} title="Risks" lines={payload.risks} />
        <CardRow icon={CheckCircle2} title="ROI / Outcome" value={payload.roi} />
      </dl>

      <ConfidenceMeter value={payload.confidence} />
    </div>
  );
}

function VerdictPill({
  verdict,
  tone,
  className,
}: {
  verdict: "YES" | "WAIT" | "NO";
  tone: "success" | "warn" | "danger";
  className?: string;
}) {
  const Icon = verdict === "YES" ? CheckCircle2 : verdict === "WAIT" ? Clock : XCircle;
  const colors =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30"
        : "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30";
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2", colors, className)}>
      <Icon className="size-5" aria-hidden />
      <span className="font-display tracking-wide">{verdict}</span>
    </div>
  );
}

function CardRow({
  icon: Icon,
  title,
  value,
  lines,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value?: string;
  lines?: string[];
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </div>
      {value ? (
        <p className="text-sm leading-relaxed">{value}</p>
      ) : null}
      {lines && lines.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground" aria-hidden>
                •
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Confidence
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-violet-500 to-emerald-400 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

function verdictClasses(tone: "success" | "warn" | "danger") {
  if (tone === "success") {
    return {
      frame: "border-emerald-200/50 dark:border-emerald-500/20",
      accent: "bg-emerald-500",
    };
  }
  if (tone === "warn") {
    return {
      frame: "border-amber-200/50 dark:border-amber-500/20",
      accent: "bg-amber-500",
    };
  }
  return {
    frame: "border-rose-200/50 dark:border-rose-500/20",
    accent: "bg-rose-500",
  };
}