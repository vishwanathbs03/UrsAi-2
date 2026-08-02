"use client";

import { useId } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { Sparkline, type SparklineProps } from "@/components/charts/Sparkline";

export type ExecutiveTone =
  | "primary"
  | "success"
  | "warn"
  | "danger"
  | "violet"
  | "info";

export interface ExecutiveKpiCardProps {
  /** Small uppercase label rendered above the headline (e.g. "Health"). */
  badge?: string;
  /** Short headline label shown to the right of the value. */
  label: string;
  /** Big numeric or string value shown prominently. */
  value: number;
  /** Optional suffix (e.g. "/100", "%", "pts"). */
  suffix?: string;
  /** Optional prefix (e.g. "+", "₹"). */
  prefix?: string;
  /** Caption rendered beneath the value. */
  caption?: string;
  /** AI insight / executive summary line. */
  insight?: string;
  /** Direction indicator (computed when omitted using trendDelta). */
  trend?: ExecutiveTone;
  /** Numeric delta used to compute trend direction; e.g. +3, -2. */
  trendDelta?: number;
  /** Trend-line sparkline values. */
  spark?: number[];
  /** Color theme for the card. */
  tone?: ExecutiveTone;
  /** Compact (smaller padding). */
  compact?: boolean;
  className?: string;
  /** Icon rendered inside the tinted badge next to the badge text. */
  icon?: React.ReactNode;
}

const TONE_MAP: Record<
  ExecutiveTone,
  { pill: string; text: string; gradient: string; sparkColor: string }
> = {
  primary: {
    pill: "tone-info",
    text: "text-primary",
    gradient: "from-primary/20 via-primary/5 to-transparent",
    sparkColor: "hsl(var(--primary))",
  },
  success: {
    pill: "tone-success",
    text: "text-emerald-600",
    gradient: "from-emerald-500/25 via-emerald-500/5 to-transparent",
    sparkColor: "hsl(152 60% 45%)",
  },
  warn: {
    pill: "tone-warn",
    text: "text-amber-600",
    gradient: "from-amber-500/25 via-amber-500/5 to-transparent",
    sparkColor: "hsl(36 80% 50%)",
  },
  danger: {
    pill: "tone-danger",
    text: "text-rose-600",
    gradient: "from-rose-500/25 via-rose-500/5 to-transparent",
    sparkColor: "hsl(0 70% 55%)",
  },
  violet: {
    pill: "tone-violet",
    text: "text-violet-600",
    gradient: "from-violet-500/25 via-violet-500/5 to-transparent",
    sparkColor: "hsl(258 70% 55%)",
  },
  info: {
    pill: "tone-info",
    text: "text-sky-600",
    gradient: "from-sky-500/25 via-sky-500/5 to-transparent",
    sparkColor: "hsl(199 89% 48%)",
  },
};

export function ExecutiveKpiCard({
  badge,
  label,
  value,
  suffix = "/100",
  prefix = "",
  caption,
  insight,
  trend,
  trendDelta,
  spark,
  tone = "primary",
  compact = false,
  className,
  icon,
}: ExecutiveKpiCardProps) {
  const styles = TONE_MAP[tone];
  const id = useId();

  // Derive trend direction from delta when not explicitly set.
  const resolvedTrend: ExecutiveTone | undefined =
    trend ??
    (typeof trendDelta === "number"
      ? trendDelta > 0
        ? "success"
        : trendDelta < 0
          ? "danger"
          : "info"
      : undefined);

  const trendTone =
    resolvedTrend === "success"
      ? "text-emerald-600"
      : resolvedTrend === "danger"
        ? "text-rose-600"
        : resolvedTrend === "warn"
          ? "text-amber-600"
          : "text-muted-foreground";
  const TrendIcon =
    typeof trendDelta === "number"
      ? trendDelta > 0
        ? ArrowUp
        : trendDelta < 0
          ? ArrowDown
          : ArrowRight
      : null;

  return (
    <article
      className={cn(
        "exec-card flex flex-col gap-3 p-4 exec-rise",
        compact ? "p-3" : "p-5",
        className,
      )}
      aria-label={`${badge ?? label} — ${label}`}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          styles.gradient,
        )}
      />
      <div className="relative flex items-center justify-between gap-2">
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              styles.pill,
            )}
          >
            {icon}
            {badge}
          </span>
        )}
        {typeof trendDelta === "number" && TrendIcon && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              trendTone,
            )}
          >
            <TrendIcon className="size-3" aria-hidden="true" />
            {trendDelta > 0 ? "+" : ""}
            {trendDelta}
          </span>
        )}
      </div>

      <div className="relative flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className={cn("text-3xl font-black tabular-nums leading-none", styles.text)}>
            <AnimatedCounter
              value={value}
              prefix={prefix}
              suffix={suffix}
              durationMs={650}
              className={cn("text-3xl font-black tabular-nums leading-none", styles.text)}
            />
          </span>
          <span className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
            {label}
          </span>
        </div>
        {spark && spark.length > 1 && (
          <Sparkline
            values={spark}
            max={Math.max(100, ...spark)}
            size={{ width: 96, height: 36 }}
            color={styles.sparkColor as SparklineProps["color"]}
            ariaLabel={`${label} sparkline trend`}
            className="w-24"
          />
        )}
      </div>

      {caption && (
        <p className="relative text-[11px] text-muted-foreground">{caption}</p>
      )}
      {insight && (
        <div
          className="relative flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2"
          id={`${id}-insight`}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            style={{ fontSize: 10, fontWeight: 700 }}
          >
            AI
          </span>
          <p className="text-[11px] leading-snug text-foreground/90">{insight}</p>
        </div>
      )}
    </article>
  );
}
