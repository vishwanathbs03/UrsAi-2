"use client";

import { Database, Lightbulb, Sparkles } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge, type StatusBadgeTone } from "@/components/dashboard/StatusBadge";
import type { SystemHealth } from "./use-system-health";

interface SystemHealthSubsystemsProps {
  data: SystemHealth;
}

/**
 * Per-subsystem breakdown (API / Database / AI / Knowledge).
 *
 * Each row surfaces the boolean ok flag plus the detail string
 * the backend returned. The component is read-only — there are
 * no buttons, no actions.
 */
export function SystemHealthSubsystems({ data }: SystemHealthSubsystemsProps) {
  return (
    <DashboardCard
      badge="Subsystems"
      title="Service health"
      caption="Individual readiness signals returned by GET /health."
    >
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        <Subsystem
          icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
          label="API"
          ok={data.api.ok}
          detail={data.api.detail}
        />
        <Subsystem
          icon={<Database className="size-4 text-primary" aria-hidden="true" />}
          label="Database"
          ok={data.database.ok}
          detail={data.database.detail}
        />
        <Subsystem
          icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
          label="AI engine"
          ok={data.ai.ok}
          detail={data.ai.detail}
        />
        <Subsystem
          icon={<Lightbulb className="size-4 text-primary" aria-hidden="true" />}
          label="Knowledge catalog"
          ok={data.knowledge.ok}
          detail={data.knowledge.detail}
        />
      </ul>
    </DashboardCard>
  );
}

interface SubsystemProps {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  detail: string;
}

function Subsystem({ icon, label, ok, detail }: SubsystemProps) {
  const tone: StatusBadgeTone = ok ? "ok" : "down";
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true">{icon}</span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </div>
      </div>
      <StatusBadge status={tone} label={ok ? "Up" : "Down"} />
    </li>
  );
}
