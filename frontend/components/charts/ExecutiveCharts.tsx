"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------- //
// HorizontalBar — animated horizontal bar chart used for Impact, Schemes,    //
// Recommendations, Funding allocation etc.                                   //
// --------------------------------------------------------------------------- //

export interface HorizontalBarRow {
  id: string;
  label: string;
  value: number;
  /** Optional right-hand caption (e.g. monetary amount). */
  caption?: string;
  /** Optional subtitle below label. */
  subtitle?: string;
  /** Optional badge tone (informational). */
  tone?: "success" | "warn" | "danger" | "info" | "violet" | "neutral";
}

export interface HorizontalBarChartProps {
  rows: HorizontalBarRow[];
  /** Maximum value for the bar scale (defaults to data max). */
  max?: number;
  /** Optional caption above the whole chart. */
  caption?: string;
  /** Optional header slot (e.g. icon + title). */
  title?: string;
  /** Clamp values to 100 (used for "% match" style bars). */
  scaleToHundred?: boolean;
  className?: string;
}

export function HorizontalBarChart({
  rows,
  max,
  caption,
  title,
  scaleToHundred = true,
  className,
}: HorizontalBarChartProps) {
  const computedMax = useMemo(() => {
    if (typeof max === "number") return max;
    const m = rows.reduce((acc, r) => Math.max(acc, r.value), 0);
    return m || 1;
  }, [max, rows]);

  const upper = scaleToHundred ? 100 : computedMax;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {(title || caption) && (
        <div className="flex flex-col gap-1">
          {title && (
            <p className="text-sm font-semibold text-foreground">{title}</p>
          )}
          {caption && (
            <p className="text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
      )}
      <ul
        role="list"
        aria-label="Horizontal bar chart"
        className="flex flex-col gap-3"
      >
        {rows.map((row, idx) => {
          const pct = Math.max(0, Math.min(upper, row.value));
          const fillPct = (pct / upper) * 100;
          const toneClass =
            row.tone === "success"
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : row.tone === "warn"
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : row.tone === "danger"
                  ? "bg-gradient-to-r from-rose-500 to-rose-400"
                  : row.tone === "violet"
                    ? "bg-gradient-to-r from-violet-500 to-violet-400"
                    : row.tone === "info"
                      ? "bg-gradient-to-r from-sky-500 to-sky-400"
                      : "bg-gradient-to-r from-primary to-sky-500";
          return (
            <li
              key={row.id}
              className={cn(
                "rounded-lg border border-border bg-background/40 p-3 exec-rise",
                idx < 6 && `exec-rise-${(idx % 6) + 1}`,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.label}
                  </p>
                  {row.subtitle && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {row.subtitle}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                  {row.value}
                  {scaleToHundred ? "" : ""}
                </span>
              </div>
              <div className="mt-2 accent-bar h-1.5 w-full overflow-hidden rounded-full">
                <span
                  className={cn("h-full", toneClass)}
                  style={{ ["--bar-fill" as string]: `${fillPct}%` }}
                />
              </div>
              {row.caption && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {row.caption}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Heatmap — 7 (days) × N (rows) GitHub-style activity heatmap.                //
// --------------------------------------------------------------------------- //

export interface HeatmapCell {
  /** 0..N column index (0..6 for 7-day week). */
  col: number;
  /** 0..N row index. */
  row: number;
  /** 0..1 intensity (clamped). */
  intensity: number;
  /** Tooltip override. */
  tooltip?: string;
}

export interface HeatmapProps {
  cells: HeatmapCell[];
  rows: string[];
  columns?: string[];
  /** Overall height per row in px (default 24). */
  cellSize?: number;
  className?: string;
  ariaLabel?: string;
}

export function Heatmap({
  cells,
  rows,
  columns,
  cellSize = 24,
  className,
  ariaLabel = "Activity heatmap",
}: HeatmapProps) {
  const cellMap = useMemo(() => {
    const m = new Map<string, HeatmapCell>();
    for (const c of cells) m.set(`${c.col}:${c.row}`, c);
    return m;
  }, [cells]);

  const cols = columns && columns.length > 0 ? columns : ["", "", "", "", "", "", ""];
  const width = cellSize * cols.length + cellSize;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${width} ${cellSize * rows.length + cellSize}`}
          className="h-auto w-full max-w-full"
        >
          {rows.map((rowLabel, rIdx) => (
            <g key={`row-${rIdx}`}>
              <text
                x={0}
                y={cellSize + rIdx * cellSize + cellSize * 0.65}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10, fontWeight: 500 }}
              >
                {rowLabel}
              </text>
              {cols.map((_, cIdx) => {
                const cell = cellMap.get(`${cIdx}:${rIdx}`);
                const intensity = cell?.intensity ?? 0;
                const fill = intensity
                  ? `hsla(217 91% 60% / ${0.15 + Math.min(0.85, intensity) * 0.85})`
                  : "hsl(var(--border) / 0.45)";
                return (
                  <rect
                    key={`cell-${cIdx}-${rIdx}`}
                    x={cellSize + cIdx * cellSize}
                    y={rIdx * cellSize + cellSize * 0.5}
                    width={cellSize - 4}
                    height={cellSize - 4}
                    rx={4}
                    fill={fill}
                    style={{
                      transition: "fill 200ms ease",
                      transformOrigin: "center",
                      animation: `riseIn 350ms ease-out ${rIdx * 30 + cIdx * 12}ms both`,
                    }}
                  >
                    <title>
                      {cell?.tooltip ?? `${rowLabel}: ${intensity.toFixed(2)}`}
                    </title>
                  </rect>
                );
              })}
            </g>
          ))}
          {cols.map((colLabel, cIdx) => (
            <text
              key={`col-${cIdx}`}
              x={cellSize + cIdx * cellSize + (cellSize - 4) / 2}
              y={cellSize * rows.length + cellSize * 0.65}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {colLabel}
            </text>
          ))}
        </svg>
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
      <span>Less</span>
      {[0, 0.25, 0.5, 0.75, 1].map((i) => (
        <span
          key={i}
          className="inline-block size-3 rounded-sm"
          style={{
            background: i
              ? `hsla(217 91% 60% / ${0.15 + i * 0.85})`
              : "hsl(var(--border) / 0.45)",
          }}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// RiskMeter — Low / Medium / High semicircle gauge with reasons.             //
// --------------------------------------------------------------------------- //

export type RiskLevel = "low" | "medium" | "high";

export interface RiskMeterProps {
  level: RiskLevel;
  /** 0..100 numeric risk score (for the dial needle). */
  score: number;
  /** Optional list of reasons explaining why this level is selected. */
  reasons?: string[];
  className?: string;
  title?: string;
}

export function RiskMeter({
  level,
  score,
  reasons = [],
  className,
  title = "Business Risk Meter",
}: RiskMeterProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    level === "high"
      ? {
          ring: "stroke-rose-500",
          text: "text-rose-600",
          chip: "tone-danger",
          label: "High",
        }
      : level === "medium"
        ? {
            ring: "stroke-amber-500",
            text: "text-amber-600",
            chip: "tone-warn",
            label: "Medium",
          }
        : {
            ring: "stroke-emerald-500",
            text: "text-emerald-600",
            chip: "tone-success",
            label: "Low",
          };

  // Map score 0..100 onto angle -180..0 (semicircle).
  const angle = Math.PI - (clamped / 100) * Math.PI; // 0..100 -> PI..0
  const cx = 100;
  const cy = 92;
  const radius = 72;
  const needleX = cx + radius * Math.cos(angle);
  const needleY = cy - radius * Math.sin(angle);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
        <div className="flex flex-col items-center gap-2">
          <svg
            role="img"
            aria-label={`Risk meter reading ${level}`}
            viewBox="0 0 200 110"
            className="h-32 w-full max-w-[220px]"
          >
            {/* Background arc */}
            <path
              d={`M 28 92 A 72 72 0 0 1 172 92`}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={12}
              strokeLinecap="round"
            />
            {/* Colored arc to current value */}
            <path
              d={`M 28 92 A 72 72 0 0 1 ${needleX} ${needleY}`}
              fill="none"
              className={tone.ring}
              strokeWidth={12}
              strokeLinecap="round"
              style={{
                transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
            {/* Needle */}
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill="hsl(var(--card))"
              stroke={tone.ring
                .replace("stroke-", "")
                .replace(/[a-z-]+/, () => "currentColor")}
              strokeWidth={3}
              className={tone.text}
              style={{ transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              className={tone.text}
              strokeWidth={2}
              style={{ transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
            {/* Labels */}
            <text
              x={28}
              y={108}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              0
            </text>
            <text
              x={100}
              y={20}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              50
            </text>
            <text
              x={172}
              y={108}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              100
            </text>
          </svg>
          <div className="flex flex-col items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", tone.chip)}>
              {tone.label} Risk
            </span>
            <span className="text-2xl font-black tabular-nums text-foreground">
              {clamped}<span className="text-base text-muted-foreground">/100</span>
            </span>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Why this risk level
          </p>
          {reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active risk signals detected.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {reasons.map((reason, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 inline-block size-1.5 rounded-full shrink-0",
                      level === "high"
                        ? "bg-rose-500"
                        : level === "medium"
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                  />
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// OpportunityMeter — semicircle gauge showing potential upside.               //
// --------------------------------------------------------------------------- //

export interface OpportunityMeterProps {
  /** 0..100 opportunity score (higher = more opportunity). */
  score: number;
  /** Match count summary. */
  availableSubsidies?: number;
  estimatedGains?: string;
  confidence?: number;
  className?: string;
}

export function OpportunityMeter({
  score,
  availableSubsidies,
  estimatedGains,
  confidence,
  className,
}: OpportunityMeterProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 70
      ? "stroke-emerald-500"
      : clamped >= 40
        ? "stroke-sky-500"
        : "stroke-amber-500";
  const angle = (clamped / 100) * Math.PI; // 0..100 -> 0..PI
  const cx = 100;
  const cy = 92;
  const radius = 72;
  const needleX = cx + radius * Math.cos(Math.PI - angle);
  const needleY = cy - radius * Math.sin(Math.PI - angle);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
        <div className="flex flex-col items-center gap-2">
          <svg
            role="img"
            aria-label={`Opportunity meter reading ${clamped}`}
            viewBox="0 0 200 110"
            className="h-32 w-full max-w-[220px]"
          >
            <path
              d={`M 28 92 A 72 72 0 0 1 172 92`}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={12}
              strokeLinecap="round"
            />
            <path
              d={`M 28 92 A 72 72 0 0 1 ${needleX} ${needleY}`}
              fill="none"
              className={tone}
              strokeWidth={12}
              strokeLinecap="round"
              style={{
                transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
            <circle cx={cx} cy={cy} r={6} fill="hsl(var(--card))" className={tone} strokeWidth={3} />
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              className={tone}
              strokeWidth={2}
              style={{ transition: "all 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
            <text
              x={28}
              y={108}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              0
            </text>
            <text
              x={172}
              y={108}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontWeight: 600 }}
            >
              100
            </text>
          </svg>
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Opportunity Score
            </span>
            <span className="text-2xl font-black tabular-nums text-foreground">
              {clamped}<span className="text-base text-muted-foreground">/100</span>
            </span>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Untapped upside
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Available subsidies" value={availableSubsidies ?? 0} suffix="" />
          <Stat label="Est. gains" value={estimatedGains ?? "—"} />
          <Stat label="Confidence" value={confidence ?? 0} suffix="%" />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border border-border bg-background/40 p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-bold text-foreground tabular-nums">
        {value}
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );
}
