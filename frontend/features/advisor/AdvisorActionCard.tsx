"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { ArrowRight, FileText, Lightbulb, ShieldAlert } from "lucide-react";
import type {
  AdvisorAction,
  AdvisorPriority,
  AdvisorSource,
} from "@/types/advisor";

interface AdvisorActionCardProps {
  action: AdvisorAction;
}

/**
 * One read-only suggestion the advisor emits. The card
 * surfaces every field the spec named (Title, Description,
 * Priority, Action Type, Reason, Source) and is not an
 * action trigger — the brief is explicit: suggestions only,
 * no buttons that execute actions.
 *
 * The "severity" column is the same Priority value (the
 * backend has no separate severity field — priority is the
 * only ordinal the advisor emits). The label is mapped
 * to the spec's user-facing copy in the surface.
 */
export function AdvisorActionCard({ action }: AdvisorActionCardProps) {
  const priority = action.priority;
  const severity: AdvisorPriority = priority;
  const typeBadge = action.action_type.toUpperCase();

  return (
    <DashboardCard compact>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {typeBadge}
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              {action.title || "Untitled suggestion"}
            </h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Priority
              </span>
              <LevelBadge
                level={priority}
                tone={levelToTone(priority)}
              />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Severity
              </span>
              <LevelBadge
                level={severity}
                tone={levelToTone(severity)}
              />
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <Field
            icon={<Lightbulb className="size-3.5" aria-hidden="true" />}
            label="Description"
            value={action.title}
          />
          <Field
            icon={<ArrowRight className="size-3.5" aria-hidden="true" />}
            label="Action Type"
            value={action.action_type}
          />
          <Field
            icon={<FileText className="size-3.5" aria-hidden="true" />}
            label="Reason"
            value={action.rationale}
          />
          <Field
            icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}
            label="Source"
            value={action.source_key}
          />
        </div>
      </div>
    </DashboardCard>
  );
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Field({ icon, label, value }: FieldProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-foreground">{value || "—"}</span>
      </span>
    </div>
  );
}

// Re-export so the view can use the same types if needed.
export type { AdvisorPriority, AdvisorSource };
