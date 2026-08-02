"use client";

/**
 * StartupSplash — the first-launch splash screen that runs once
 * per session, immediately after the user lands in the auth'd
 * app shell. The brief calls for:
 *
 *   1. Logo appears
 *   2. UrsBiz initializes
 *   3. Loading Business Intelligence
 *   4. Loading Advisor Engine
 *   5. Loading Decision Engine
 *      -> transition smoothly to dashboard
 *
 * The splash is wired into the (app) layout and runs once per
 * session via a `sessionStorage` flag so subsequent nav doesn't
 * replay it. The component is self-contained: it schedules its
 * own phase advances with a single `setTimeout` chain, owns the
 * fade-out, and unmounts. The dashboard never has to know.
 *
 * The sequence is timed so the total visible duration is around
 * 3.0s - long enough to read, short enough to not annoy. Phases
 * advance on a fixed cadence; nothing reads network state. The
 * business logic does not depend on this component.
 */

import { useEffect, useState } from "react";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import {
  Brain,
  CheckCircle2,
  Compass,
  Loader2,
  Sparkles,
} from "lucide-react";

const STORAGE_KEY = "atlas.startupSplash.v1";

type PhaseId =
  | "logo"
  | "atlas-init"
  | "business-intelligence"
  | "advisor-engine"
  | "decision-engine"
  | "done";

const PHASES: ReadonlyArray<{
  id: PhaseId;
  label: string;
  // ms after the splash mounts before this phase becomes "active".
  at: number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}> = [
  { id: "logo",                 label: "UrsBiz initializing",            at: 0,    icon: Sparkles },
  { id: "atlas-init",           label: "UrsBiz initializing",            at: 400,  icon: Brain },
  { id: "business-intelligence",label: "Loading Business Intelligence",   at: 900,  icon: Compass },
  { id: "advisor-engine",       label: "Loading Advisor Engine",          at: 1500, icon: Sparkles },
  { id: "decision-engine",      label: "Loading Decision Engine",         at: 2100, icon: Brain },
  { id: "done",                 label: "Ready",                           at: 2700, icon: CheckCircle2 },
];

const FADE_OUT_MS = 400;
const TOTAL_HOLD_MS = 3000;

export function StartupSplash() {
  const [phase, setPhase] = useState<PhaseId>("logo");
  const [mounted, setMounted] = useState(false);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  // Decide whether to run the splash on this render.
  useEffect(() => {
    if (typeof window === "undefined") {
      setMounted(false);
      return;
    }
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private mode / disabled storage — treat as first-launch.
      alreadySeen = false;
    }
    if (alreadySeen) {
      setGone(true);
      setMounted(true);
      return;
    }
    setMounted(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore — purely a hint */
    }
  }, []);

  // Phase timeline.
  useEffect(() => {
    if (!mounted || gone) return;
    const timers: number[] = [];
    for (const p of PHASES) {
      const t = window.setTimeout(() => {
        setPhase(p.id);
      }, p.at);
      timers.push(t);
    }
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, TOTAL_HOLD_MS);
    const unmountTimer = window.setTimeout(() => {
      setGone(true);
    }, TOTAL_HOLD_MS + FADE_OUT_MS);
    timers.push(fadeTimer, unmountTimer);
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [mounted, gone]);

  if (gone) return null;

  const isDone = phase === "done";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading UrsBiz"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8",
        "bg-gradient-to-br from-background via-background to-primary/5",
        "transition-opacity ease-out",
        fading ? "opacity-0" : "opacity-100",
        "duration-400",
      )}
      data-splash-phase={phase}
    >
      {/* Logo + wordmark */}
      <div
        className={cn(
          "flex items-center gap-3 transition-all duration-700 ease-out",
          phase === "logo" && !isDone
            ? "opacity-0 translate-y-3 scale-95"
            : "opacity-100 translate-y-0 scale-100",
        )}
      >
        <div className="relative">
          <Logo size="lg" />
          <span
            className={cn(
              "absolute inset-0 -m-2 rounded-full",
              !isDone && "animate-ping bg-primary/20",
            )}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Status card with phase list */}
      <div
        className={cn(
          "w-full max-w-md rounded-xl border border-border bg-card/70 px-6 py-5 shadow-soft backdrop-blur",
          "transition-all duration-700 ease-out",
          phase === "logo" && !isDone
            ? "opacity-0 translate-y-2"
            : "opacity-100 translate-y-0",
        )}
      >
        <ul className="flex flex-col gap-2.5">
          {PHASES.filter((p) => p.id !== "logo").map((p) => {
            const stageIndex = PHASES.findIndex((x) => x.id === p.id);
            const currentIndex = PHASES.findIndex((x) => x.id === phase);
            const completed = currentIndex > stageIndex;
            const active = currentIndex === stageIndex;
            const Icon = p.icon;
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 text-sm"
                aria-live={active ? "polite" : "off"}
              >
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full",
                    completed && "bg-emerald-500/15 text-emerald-500",
                    active && !completed && "bg-primary/15 text-primary",
                    !completed && !active && "bg-muted text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {completed ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </span>
                <span
                  className={cn(
                    "transition-colors",
                    completed && "text-emerald-600 dark:text-emerald-400",
                    active && !completed && "font-medium text-foreground",
                    !completed && !active && "text-muted-foreground",
                  )}
                >
                  {p.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tiny footer */}
      <p
        className={cn(
          "text-[10px] uppercase tracking-widest text-muted-foreground",
          "transition-opacity duration-700",
          isDone ? "opacity-0" : "opacity-100",
        )}
      >
        UrsBiz AI-Powered Business Intelligence Platform
      </p>
    </div>
  );
}
