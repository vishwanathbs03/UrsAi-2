"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";

// --------------------------------------------------------------------------- //
// ExecutiveInsightCard — premium section card with header, KPI slot, badge.  //
// --------------------------------------------------------------------------- //

export interface ExecutiveInsightCardProps {
  badge?: string;
  title: string;
  caption?: string;
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Tinted accent line at top — gives the page visual rhythm. */
  accent?: boolean;
}

export function ExecutiveInsightCard({
  badge,
  title,
  caption,
  trailing,
  icon,
  children,
  className,
  accent = true,
}: ExecutiveInsightCardProps) {
  return (
    <section
      className={cn("exec-card flex flex-col gap-4 p-5 exec-rise", className)}
    >
      {accent && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-sky-500 to-violet-500"
        />
      )}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {badge && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {icon}
              {badge}
            </span>
          )}
          <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
          {caption && (
            <p className="text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// ImprovementGauge — circular gauge showing rise from baseline to target.    //
// --------------------------------------------------------------------------- //

export interface ImprovementGaugeProps {
  /** Current value. */
  current: number;
  /** Target value. */
  target: number;
  /** Display label. */
  label: string;
  /** Suffix for the count (e.g. "+pts"). */
  suffix?: string;
  /** Tone for the gauge arc. */
  tone?: "primary" | "success" | "warn";
  size?: number;
  className?: string;
}

export function ImprovementGauge({
  current,
  target,
  label,
  suffix = "+pts",
  tone = "primary",
  size = 120,
  className,
}: ImprovementGaugeProps) {
  const safeCurrent = Math.max(0, current);
  const safeTarget = Math.max(safeCurrent + 1, target);
  const lift = safeTarget - safeCurrent;
  const clamped = Math.min(100, Math.max(0, safeCurrent));
  const liftPct = Math.min(100, (lift / Math.max(1, safeTarget)) * 100);
  const cx = size / 2;
  const cy = size / 2 + 4;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (clamped / 100) * (circumference * 0.75);
  const stroke =
    tone === "success"
      ? "stroke-emerald-500"
      : tone === "warn"
        ? "stroke-amber-500"
        : "stroke-primary";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3",
        className,
      )}
      aria-label={`${label}: ${current} of ${target} (${lift} point lift)`}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full"
        role="img"
        aria-hidden="true"
      >
        <g transform={`rotate(135 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={6}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            className={stroke}
            strokeWidth={6}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            style={{
              transition: "stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </g>
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground"
          style={{ fontSize: 22, fontWeight: 800 }}
        >
          {Math.round(current)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1 }}
        >
          OF {Math.round(target)}
        </text>
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-foreground">
        <AnimatedCounter
          value={lift}
          prefix="+"
          suffix={suffix}
          durationMs={500}
          className="text-[11px] font-semibold tabular-nums text-foreground"
        />
        <span className="ml-1 text-muted-foreground">({Math.round(liftPct)}%)</span>
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// AnimatedTimeline — animated horizontal timeline with progressive reveal.   //
// --------------------------------------------------------------------------- //

export interface AnimatedTimelineProps {
  points: { label: string; value: number; caption?: string; tone?: string }[];
  /** Display unit (e.g. "/100"). */
  unit?: string;
  className?: string;
}

export function AnimatedTimeline({
  points,
  unit = "",
  className,
}: AnimatedTimelineProps) {
  const id = useId();
  const W = 800;
  const H = 220;
  const pad = { top: 30, right: 36, bottom: 44, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xs = (i: number) =>
    pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
  const ys = (v: number) => pad.top + plotH - (Math.min(100, Math.max(0, v)) / 100) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(p.value)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${pad.left + plotW} ${pad.top + plotH} L ${pad.left} ${pad.top + plotH} Z`;

  return (
    <svg
      role="img"
      aria-label="Animated growth timeline"
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-tl-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={`grid-${t}`}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={pad.top + plotH * (1 - t)}
            y2={pad.top + plotH * (1 - t)}
            stroke="hsl(var(--border))"
            strokeDasharray={t === 1 ? undefined : "3 4"}
            strokeOpacity={t === 1 ? 0.8 : 0.4}
            strokeWidth={1}
          />
          <text
            x={pad.left - 6}
            y={pad.top + plotH * (1 - t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {Math.round(t * 100)}
          </text>
        </g>
      ))}
      {/* Area + line */}
      <path d={areaPath} fill={`url(#${id}-tl-grad)`} />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1200,
          strokeDashoffset: 1200,
          animation: "tlReveal 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      />
      {/* Points */}
      {points.map((p, i) => (
        <g
          key={`pt-${i}`}
          style={{
            animation: `riseIn 400ms ease-out ${300 + i * 120}ms both`,
            transformOrigin: `${xs(i)}px ${ys(p.value)}px`,
          }}
        >
          <circle
            cx={xs(i)}
            cy={ys(p.value)}
            r={6}
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
          />
          <text
            x={xs(i)}
            y={ys(p.value) - 14}
            textAnchor="middle"
            className="fill-foreground"
            style={{
              fontSize: 12,
              fontWeight: 700,
              paintOrder: "stroke",
              stroke: "hsl(var(--background))",
              strokeWidth: 3,
            }}
          >
            {Math.round(p.value)}
            {unit}
          </text>
          <text
            x={xs(i)}
            y={H - 12}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {p.label}
          </text>
          {p.caption && (
            <text
              x={xs(i)}
              y={H - 28}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {p.caption}
            </text>
          )}
        </g>
      ))}
      <style>{`
        @keyframes tlReveal {
          from { stroke-dashoffset: 1200; opacity: 0.4; }
          to   { stroke-dashoffset: 0;    opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
