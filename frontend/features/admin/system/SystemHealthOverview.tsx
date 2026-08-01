"use client";

import { Activity, Clock, Gauge, Server, ShieldCheck } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { StatusBadge, type StatusBadgeTone } from "@/components/dashboard/StatusBadge";
import type { SystemHealth } from "./use-system-health";

interface SystemHealthOverviewProps {
  data: SystemHealth;
}

/**
 * Top-of-page card row showing the six spec fields.
 *
 * The "Average latency" cell uses ProgressBar so the value is
 * visually anchored to a 0-1000 ms scale (the long tail of the
 * histogram bucket set in the backend). The card order is fixed
 * by the spec:
 *
 *   Health | Version | Uptime | Request count | Active requests
 *   Average latency | Error rate
 */
export function SystemHealthOverview({ data }: SystemHealthOverviewProps) {
  const overallTone: StatusBadgeTone = deriveOverallTone(data);
  const errorRatePct = clamp(data.error_rate * 100, 0, 100);
  const latencyPct = clamp((data.avg_latency_ms / 1000) * 100, 0, 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<ShieldCheck className="size-4 text-primary" aria-hidden="true" />}
        label="Health"
        value={data.status === "ok" ? "Healthy" : "Degraded"}
        tone={overallTone}
        badge={<StatusBadge status={overallTone} />}
      />
      <KpiCard
        icon={<Server className="size-4 text-primary" aria-hidden="true" />}
        label="Version"
        value={data.version}
        hint={`env: ${data.env}`}
      />
      <KpiCard
        icon={<Clock className="size-4 text-primary" aria-hidden="true" />}
        label="Uptime"
        value={formatUptime(data.uptime)}
        hint={`since ${formatTimestamp(data.timestamp)}`}
      />
      <KpiCard
        icon={<Activity className="size-4 text-primary" aria-hidden="true" />}
        label="Request count"
        value={formatInteger(data.request_count)}
        hint={`active: ${data.active_requests}`}
      />
      <DashboardCard
        badge="Latency"
        title="Average latency"
        caption="Process-wide mean across all endpoints."
        compact
      >
        <ProgressBar
          value={latencyPct}
          label={formatMs(data.avg_latency_ms)}
          hint="0–1000 ms scale"
          ariaLabel="Average latency"
        />
      </DashboardCard>
      <DashboardCard
        badge="Errors"
        title="Error rate"
        caption="Share of HTTP responses that returned 5xx."
        compact
      >
        <ProgressBar
          value={errorRatePct}
          label={formatPercent(data.error_rate)}
          hint={errorRatePct > 1 ? "Investigate" : "within budget"}
          fillClassName={errorRatePct > 1 ? "bg-amber-500" : "bg-emerald-500"}
          ariaLabel="Error rate"
        />
      </DashboardCard>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Internal helpers
// --------------------------------------------------------------------------- //

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: StatusBadgeTone;
  badge?: React.ReactNode;
}

function KpiCard({ icon, label, value, hint, badge }: KpiCardProps) {
  return (
    <DashboardCard
      badge={label}
      title={value}
      caption={hint}
      compact
      trailing={badge}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
    </DashboardCard>
  );
}

function deriveOverallTone(data: SystemHealth): StatusBadgeTone {
  if (
    data.api.ok &&
    data.database.ok &&
    data.ai.ok &&
    data.knowledge.ok &&
    data.error_rate < 0.05
  ) {
    return "ok";
  }
  if (
    data.api.ok &&
    (data.database.ok || data.ai.ok || data.knowledge.ok)
  ) {
    return "warn";
  }
  return "down";
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value)));
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "0 ms";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatPercent(p: number): string {
  if (!Number.isFinite(p)) return "0%";
  return `${(p * 100).toFixed(2)}%`;
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
