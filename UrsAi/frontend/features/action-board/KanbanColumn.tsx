"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, ListTodo } from "lucide-react";
import type { ActionCardItem } from "./use-action-board-data";
import type { ActionStatus } from "./use-action-status-storage";
import { ActionCard } from "./ActionCard";

interface KanbanColumnProps {
  status: ActionStatus;
  title: string;
  caption: string;
  cards: ActionCardItem[];
  /** Look up the persisted status for a card. */
  resolveStatus: (id: string) => ActionStatus;
  /** Persist a new status for a card after a drop. */
  onDrop: (cardId: string, target: ActionStatus) => void;
  /** Open the slide-over for a card. */
  onCardOpen: (cardId: string) => void;
}

const COLUMN_META: Record<
  ActionStatus,
  { icon: React.ComponentType<{ className?: string }>; tone: string; ring: string }
> = {
  todo: {
    icon: ListTodo,
    tone: "text-slate-600",
    ring: "ring-slate-300/60",
  },
  in_progress: {
    icon: Clock,
    tone: "text-amber-600",
    ring: "ring-amber-300/60",
  },
  completed: {
    icon: CheckCircle2,
    tone: "text-emerald-600",
    ring: "ring-emerald-300/60",
  },
};

/**
 * Drag payload contract: a plain JSON string holding the
 * action id. The drop target reads it from
 * `event.dataTransfer.getData("text/plain")`.
 */
const DRAG_MIME = "text/plain";

/**
 * One column on the Kanban board. Owns its drag-over
 * highlight state; defers the actual status write to the
 * parent so storage stays in one place.
 *
 * Why native HTML5 drag-and-drop instead of @dnd-kit:
 *   1. The spec says "Frontend only" + "Use existing APIs
 *      only" — adding a runtime dep is the wrong call for
 *      one new screen.
 *   2. Native DnD has zero install cost and is well within
 *      what the existing dashboard primitives can compose
 *      with. Accessibility is augmented with explicit
 *      `aria-*` and a "Move to..." select on each card so
 *      keyboard / touch users get the same affordance.
 */
export function KanbanColumn({
  status,
  title,
  caption,
  cards,
  resolveStatus,
  onDrop,
  onCardOpen,
}: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const meta = COLUMN_META[status];
  const Icon = meta.icon;

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only accept drags carrying our payload.
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isOver) setIsOver(true);
    },
    [isOver],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Ignore `dragenter`/`dragleave` fired by child nodes —
    // only flip off when the pointer truly leaves the column.
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      const id = e.dataTransfer.getData(DRAG_MIME);
      if (id) onDrop(id, status);
    },
    [onDrop, status],
  );

  return (
    <section
      aria-label={`${title} column`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-[24rem] flex-col rounded-xl border border-border bg-secondary/20 p-3 transition-colors",
        isOver && `ring-2 ring-offset-2 ring-offset-background ${meta.ring}`,
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", meta.tone)} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="inline-flex items-center justify-center rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {cards.length}
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {caption}
        </p>
      </header>

      <div
        className="flex flex-1 flex-col gap-2"
        // Empty-state hint when the column has no cards.
        aria-live="polite"
      >
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-3 py-10 text-center text-xs text-muted-foreground">
            {isOver
              ? "Drop to move here"
              : "Drop action cards here"}
          </div>
        ) : (
          cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              currentStatus={resolveStatus(card.id)}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              onOpen={onCardOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface DraggableCardProps {
  card: ActionCardItem;
  currentStatus: ActionStatus;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  onOpen: (cardId: string) => void;
}

/**
 * Thin wrapper around `ActionCard` that owns the
 * `dataTransfer` payload. Separated from `ActionCard` so the
 * card itself stays free of drag state and can be reused in
 * a non-Kanban context later.
 */
function DraggableCard({
  card,
  currentStatus,
  draggingId,
  setDraggingId,
  onOpen,
}: DraggableCardProps) {
  // The card's click handler is suppressed for a short
  // window after a drag finishes, so a drop on the same
  // column doesn't also pop the slide-over open.
  const justDraggedRef = useRef<number>(0);
  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(DRAG_MIME, card.id);
      setDraggingId(card.id);
      justDraggedRef.current = Date.now();
    },
    [card.id, setDraggingId],
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    justDraggedRef.current = Date.now();
  }, [setDraggingId]);

  const handleActivate = useCallback(() => {
    // Suppress click-to-open for 250ms after a drag end —
    // native HTML5 DnD doesn't separate drag-end from
    // click, so the mouse-up that completes a drop would
    // otherwise also fire the open handler.
    if (Date.now() - justDraggedRef.current < 250) return;
    onOpen(card.id);
  }, [card.id, onOpen]);

  return (
    <ActionCard
      card={card}
      status={currentStatus}
      isDragging={draggingId === card.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onActivate={handleActivate}
    />
  );
}
