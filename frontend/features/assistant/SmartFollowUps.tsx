"use client";

import { Sparkles, Zap } from "lucide-react";

interface FollowUpShape {
  id: string;
  label: string;
  prompt: string;
  routesTo: string;
}

export interface SmartFollowUpsProps {
  followUps: ReadonlyArray<FollowUpShape>;
  onSelect: (f: FollowUpShape) => void;
  disabled?: boolean;
}

/**
 * Renders the three contextual follow-up suggestions the
 * consultant orchestrator derived for the most recent reply.
 * Renders nothing when there is no history yet (the empty
 * ConversationList greeting already covers the cold-start case).
 */
export function SmartFollowUps({
  followUps,
  onSelect,
  disabled,
}: SmartFollowUpsProps) {
  if (followUps.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border bg-background/40 p-2.5"
      aria-label="Smart follow-up questions"
    >
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="size-3 text-primary" aria-hidden />
        Smart follow-ups
      </div>
      <div className="flex flex-wrap gap-2">
        {followUps.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(f)}
            className="group inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:-translate-y-px hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <Zap
              className="size-3 text-primary/70 transition group-hover:text-primary"
              aria-hidden
            />
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}