"use client";

import { cn } from "@/lib/utils";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { PRIORITY_LABELS, type ActionCardItem } from "./use-action-board-data";
import { type ActionStatus, STATUS_LABELS } from "./use-action-status-storage";
import {
  Brain,
  CalendarClock,
  CircleDot,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
} from "lucide-react";

interface ActionCardProps {
  card: ActionCardItem;
  status: ActionStatus;
  /** Card is currently being dragged — used to dim the source slot. */
  isDragging?: boolean;
  /** Native drag handlers. The card is `draggable` itself. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Click handler for opening the action details
   *  slide-over. The DraggableCard wrapper suppresses this
   *  for ~120ms after a drag so the mouse-up at the end of
   *  a drop doesn't double-fire as a click. */
  onActivate?: () => void;
}

const STATUS_BADGE_TONE: Record<ActionStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
};

const DIFFICULTY_TONE: Record<ActionCardItem["difficulty"], string> = {
  Easy: "bg-emerald-100 text-emerald-700",
  Moderate: "bg-sky-100 text-sky-700",
  Hard: "bg-amber-100 text-amber-800",
  Expert: "bg-rose-100 text-rose-700",
};

/**
 * Priority → CSS accent stripe (left border). Keeps the card
 * scannable in a column with many items.
 */
const PRIORITY_ACCENT: Record<ActionCardItem["priority"], string> = {
  Critical: "before:bg-rose-500",
  High: "before:bg-orange-500",
  Medium: "before:bg-amber-400",
  Low: "before:bg-emerald-500",
};

/**
 * One action card on the Kanban board. Renders every field
 * the spec asked for (title, priority, category, impact, ROI,
 * expected score improvement, time, difficulty, supporting
 * knowledge count, AI explanation, status badge) in a single
 * dense card that still feels light on mobile.
 *
 * The whole card is `draggable`; the parent column handles
 * the `dragover`/`drop` side.
 */
export function ActionCard({
  card,
  status,
  isDragging = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  onActivate,
}: ActionCardProps) {
  return (
    <article
      role="article"
      aria-label={`${card.title} — ${PRIORITY_LABELS[card.priority]} priority action`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onActivate}
      onKeyDown={(e) => {
        // Open on Enter / Space when the article itself is
        // focused. The native button affordances inside the
        // card (priority badge, status badge) are not
        // interactive so this is safe.
        if (!onActivate) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      tabIndex={onActivate ? 0 : -1}
      data-action-id={card.id}
      data-action-status={status}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-soft",
        "transition-all duration-150",
        // The accent stripe on the left.
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:content-['']",
        PRIORITY_ACCENT[card.priority],
        // Drag affordances
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        draggable &&
          "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        onActivate && "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {card.category}
          </p>
          <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {card.title}
          </h4>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <LevelBadge
            level={PRIORITY_LABELS[card.priority]}
            tone={levelToTone(
              card.priority === "Critical" || card.priority === "High"
                ? "low"
                : card.priority === "Medium"
                ? "medium"
                : "high",
            )}
          />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              STATUS_BADGE_TONE[status],
            )}
            aria-label={`Status: ${STATUS_LABELS[status]}`}
          >
            <CircleDot className="size-2.5" aria-hidden="true" />
            {STATUS_LABELS[status]}
          </span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Stat
          icon={<TrendingUp className="size-3" aria-hidden="true" />}
          label="Impact"
          value={`${card.estimatedBusinessImpact}/100`}
        />
        <Stat
          icon={<Target className="size-3" aria-hidden="true" />}
          label="Est. ROI"
          value={`${card.estimatedRoi}/100`}
        />
        <Stat
          icon={<Sparkles className="size-3" aria-hidden="true" />}
          label="Score ↑"
          value={`+${card.expectedScoreImprovement.toFixed(1)}%`}
        />
        <Stat
          icon={<TimerReset className="size-3" aria-hidden="true" />}
          label="Time"
          value={card.estimatedTime}
        />
        <Stat
          icon={<GraduationCap className="size-3" aria-hidden="true" />}
          label="Difficulty"
          value={
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                DIFFICULTY_TONE[card.difficulty],
              )}
            >
              {card.difficulty}
            </span>
          }
        />
        <Stat
          icon={<Brain className="size-3" aria-hidden="true" />}
          label="Knowledge"
          value={`${card.supportingKnowledgeCount} item${card.supportingKnowledgeCount === 1 ? "" : "s"}`}
        />
      </dl>

      <div
        className={cn(
          "rounded-md border border-border bg-secondary/30 p-2.5",
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="size-3" aria-hidden="true" />
          AI Explanation
          {card.hasAiBacking && card.aiConfidence !== null && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
              <CalendarClock className="size-2.5" aria-hidden="true" />
              {card.aiConfidence}% confidence
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-foreground">
          {card.aiExplanation}
        </p>
        {card.sourceKeys.length > 0 && (
          <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
            source: {card.sourceKeys.join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

/**
 * Tiny labelled stat row used in the action card grid.
 * Kept as a local helper so the card file stays
 * self-contained; not exported.
 */
function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 truncate text-xs font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}
