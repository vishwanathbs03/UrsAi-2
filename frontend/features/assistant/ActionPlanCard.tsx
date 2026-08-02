"use client";

import { Check, ChevronDown, Clock, ListChecks } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ActionWeek } from "./types";

/**
 * Renders a week-by-week action plan.
 *
 * The card opens with the first week expanded by default; the
 * remaining weeks collapse so the user sees the immediate
 * steps without scrolling.
 */
export function ActionPlanCard({
  title,
  caption,
  weeks,
}: {
  title: string;
  caption?: string;
  weeks: ActionWeek[];
}) {
  if (weeks.length === 0) {
    return (
      <div className="exec-card rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        <ListChecks className="mr-2 inline size-4 align-middle" aria-hidden />
        Action plan will populate once a top recommendation is selected.
      </div>
    );
  }
  return (
    <div className="exec-card relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-emerald-400" />
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Action plan
          </p>
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          {caption ? (
            <p className="text-sm text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        <Clock className="size-5 text-muted-foreground" aria-hidden />
      </header>
      <ol className="space-y-2">
        {weeks.map((week, i) => (
          <Week
            key={`${week.weekNumber}-${week.weekLabel}`}
            week={week}
            defaultOpen={i === 0}
            index={week.weekNumber || i + 1}
          />
        ))}
      </ol>
    </div>
  );
}

function Week({
  week,
  defaultOpen,
  index,
}: {
  week: ActionWeek;
  defaultOpen: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const heading = week.weekLabel || week.week || `Week ${index}`;
  const actions = week.actions && week.actions.length > 0 ? week.actions : week.steps;
  return (
    <li
      className={cn(
        "rounded-xl border bg-background/60 transition-colors",
        open ? "shadow-sm" : "hover:bg-muted/30",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
          {index}
        </span>
        <div className="flex-1">
          <div className="text-sm font-medium">{heading}</div>
          {week.objective ? (
            <div className="text-xs text-muted-foreground">{week.objective}</div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-1.5 px-4 pb-3">
          {actions.map((step: string, j: number) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-emerald-500"
                aria-hidden
              />
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}