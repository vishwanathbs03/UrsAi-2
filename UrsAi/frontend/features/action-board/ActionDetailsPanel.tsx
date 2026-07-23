"use client";

import { useId } from "react";
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
  CheckCircle2,
  Clock,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { cn } from "@/lib/utils";
import {
  type ActionCardItem,
  PRIORITY_LABELS,
} from "./use-action-board-data";
import {
  type ActionStatus,
  ACTION_STATUS_VALUES,
  STATUS_LABELS,
} from "./use-action-status-storage";

interface ActionDetailsPanelProps {
  card: ActionCardItem;
  status: ActionStatus;
  onChangeStatus: (next: ActionStatus) => void;
  /** Article ids from the upstream AI insight. The action
   *  board itself does not have a knowledge service yet, so
   *  this list is rendered as a "no content yet" section
   *  with the right count and shape — the article titles
   *  will be filled in once a real article service lands. */
  relatedArticleIds: string[];
  /** True while the action card is on the AI Decision
   *  insight list (i.e. `hasAiBacking`). Used to gate the
   *  AI explanation block. */
  hasAiBacking: boolean;
  /** AI confidence (0..100) when AI-backed, else null. */
  aiConfidence: number | null;
}

const STATUS_ICONS: Record<ActionStatus, LucideIcon> = {
  todo: ListTodo,
  in_progress: Clock,
  completed: CheckCircle2,
};

const STATUS_TONE: Record<ActionStatus, string> = {
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

const PRIORITY_ACCENT: Record<ActionCardItem["priority"], string> = {
  Critical: "before:bg-rose-500",
  High: "before:bg-orange-500",
  Medium: "before:bg-amber-400",
  Low: "before:bg-emerald-500",
};

/**
 * Body of the action-details slide-over. Renders:
 *   - Title + category + priority + status pills
 *   - Estimated timeline (timeline badge) + difficulty
 *   - Stat grid: Impact, ROI, Score lift, Effort
 *   - AI Explanation panel (full text, including the
 *     rationale and confidence when backed)
 *   - Related knowledge articles section
 *   - "Move to..." picker (set the persisted status)
 */
export function ActionDetailsPanel({
  card,
  status,
  onChangeStatus,
  relatedArticleIds,
  hasAiBacking,
  aiConfidence,
}: ActionDetailsPanelProps) {
  const statusLabelId = useId();
  const StatusIcon = STATUS_ICONS[status];

  return (
    <div className="flex flex-col gap-4">
      {/* Title + status pills */}
      <div
        className={cn(
          "relative flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3",
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:content-['']",
          PRIORITY_ACCENT[card.priority],
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {card.category}
        </p>
        <h3 className="text-base font-semibold leading-snug text-foreground">
          {card.title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
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
            id={statusLabelId}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
              STATUS_TONE[status],
            )}
          >
            <StatusIcon className="size-3" aria-hidden="true" />
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      {/* Estimated timeline (timeline badge) + difficulty */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TimelineBadge
          time={card.estimatedTime}
          difficulty={card.difficulty}
        />
        <DifficultyCard
          difficulty={card.difficulty}
          impact={card.estimatedBusinessImpact}
        />
      </div>

      {/* Stat grid */}
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
        <Stat
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
          label="Impact"
          value={
            <span className="inline-flex items-baseline gap-1">
              <AnimatedCounter value={card.estimatedBusinessImpact} />
              <span className="text-xs text-muted-foreground">/ 100</span>
            </span>
          }
        />
        <Stat
          icon={<Target className="size-3.5" aria-hidden="true" />}
          label="Est. ROI"
          value={
            <span className="inline-flex items-baseline gap-1">
              <AnimatedCounter value={card.estimatedRoi} />
              <span className="text-xs text-muted-foreground">/ 100</span>
            </span>
          }
        />
        <Stat
          icon={<Sparkles className="size-3.5" aria-hidden="true" />}
          label="Score lift"
          value={
            <span className="text-emerald-600">
              +<AnimatedCounter
                value={card.expectedScoreImprovement}
                decimals={1}
                durationMs={500}
              />
              %
            </span>
          }
        />
        <Stat
          icon={<TimerReset className="size-3.5" aria-hidden="true" />}
          label="Effort"
          value={card.estimatedTime}
        />
      </dl>

      {/* AI Explanation panel */}
      <section
        aria-labelledby="ai-explanation-heading"
        className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
      >
        <header className="flex items-center justify-between gap-2">
          <h4
            id="ai-explanation-heading"
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <Lightbulb className="size-3" aria-hidden="true" />
            AI Explanation
          </h4>
          {hasAiBacking && aiConfidence !== null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
              <CalendarClock className="size-3" aria-hidden="true" />
              <AnimatedCounter
                value={aiConfidence}
                suffix="%"
                durationMs={500}
              />
              <span>confidence</span>
            </span>
          )}
        </header>
        <p className="text-sm leading-relaxed text-foreground">
          {card.aiExplanation}
        </p>
        {card.sourceKeys.length > 0 && (
          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            source: {card.sourceKeys.join(" · ")}
          </p>
        )}
        {!hasAiBacking && (
          <p className="text-[10px] text-muted-foreground">
            No AI insight currently backs this action — the explanation is the
            rule engine&apos;s reason.
          </p>
        )}
      </section>

      {/* Related knowledge articles */}
      <section
        aria-labelledby="related-knowledge-heading"
        className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
      >
        <header className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <GraduationCap className="size-3" aria-hidden="true" />
          <h4 id="related-knowledge-heading">
            Related knowledge ({relatedArticleIds.length})
          </h4>
        </header>
        {relatedArticleIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No related knowledge articles linked to this action yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {relatedArticleIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-xs text-foreground">
                  {id}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  aria-label="Knowledge article"
                >
                  <Brain className="size-3" aria-hidden="true" />
                  Article
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-muted-foreground">
          Article titles will populate once the knowledge service is
          available; today the IDs above come from the AI Decision insight.
        </p>
      </section>

      {/* "Move to..." picker */}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
        <h4 className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <CircleDot className="size-3" aria-hidden="true" />
          Move to column
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {ACTION_STATUS_VALUES.map((s) => {
            const Icon = STATUS_ICONS[s];
            const active = s === status;
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => onChangeStatus(s)}
                aria-pressed={active}
                aria-label={`Move to ${STATUS_LABELS[s]}`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {STATUS_LABELS[s]}
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

function TimelineBadge({
  time,
  difficulty,
}: {
  time: string;
  difficulty: ActionCardItem["difficulty"];
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 p-3">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <TimerReset className="size-3" aria-hidden="true" />
        Estimated timeline
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground">
        {time}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Difficulty:{" "}
        <span
          className={cn(
            "ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            DIFFICULTY_TONE[difficulty],
          )}
        >
          {difficulty}
        </span>
      </p>
    </div>
  );
}

function DifficultyCard({
  difficulty,
  impact,
}: {
  difficulty: ActionCardItem["difficulty"];
  impact: number;
}) {
  const hint = difficultyHint(difficulty, impact);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/30 p-3">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles className="size-3" aria-hidden="true" />
        Why this difficulty
      </p>
      <p className="text-sm font-semibold text-foreground">{difficulty}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function difficultyHint(difficulty: ActionCardItem["difficulty"], impact: number): string {
  if (difficulty === "Easy") return "Quick win — low effort, high priority.";
  if (difficulty === "Moderate") return "Standard lift — a few days of focused work.";
  if (difficulty === "Hard") return `Substantial — impact ${impact}/100 calls for planning.`;
  return "Specialist effort — consider external support.";
}
