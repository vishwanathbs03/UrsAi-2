"use client";

import { useCallback, useMemo, useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { SlideOver } from "@/components/common/SlideOver";
import { Button } from "@/components/ui/button";
import {
  type ActionCardItem,
  PRIORITY_LABELS,
  useActionBoardData,
} from "./use-action-board-data";
import {
  useActionStatusStorage,
  STATUS_LABELS,
  type ActionStatus,
} from "./use-action-status-storage";
import {
  applyFilters,
  applySort,
  DEFAULT_BOARD_FILTERS,
  type BoardFilters,
} from "./use-action-board-filters";
import { BoardControls } from "./BoardControls";
import { BoardSummaryPanel } from "./BoardSummaryPanel";
import { BusinessJourneyPreview } from "./BusinessJourneyPreview";
import { ActionDetailsPanel } from "./ActionDetailsPanel";
import { useDnaQuery, useScoresQuery } from "@/features/dashboard";
import { Building2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";

/**
 * Top-level view for the Interactive Action Board.
 *
 * Sprint 4 — Polish & UX Enhancement additions on top of
 * the Sprint 4 Part 2 Kanban:
 *  - Search + filter + sort controls above the columns
 *  - Progress / improvement / impact summary panel
 *  - Business Journey preview (current vs projected DNA)
 *  - Slide-over action details with related knowledge
 *    articles, AI explanation, and an inline "Move to"
 *    picker
 *  - TanStack Query under the hood (cached, deduped)
 *
 * The pre-existing responsibilities (loading / error /
 * no-business states, Kanban rendering, drag-and-drop,
 * status persistence) are preserved unchanged.
 */
export function ActionBoardView() {
  const { state, refresh, isFetching } = useActionBoardData();
  const storage = useActionStatusStorage();
  // We also subscribe to the scores and DNA queries directly
  // so the summary / journey preview can read the current
  // overall score + archetype without re-fetching. The
  // QueryClient dedupes these against the action board's
  // own useActionBoardData fetch, so no extra HTTP traffic.
  const scoresQuery = useScoresQuery();
  const dnaQuery = useDnaQuery();

  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // Group once per state / storage / filter change. Cheap;
  // the card list is bounded by `summary.total_firings`
  // (typically < 50).
  const groups = useMemo(() => {
    const byStatus: Record<ActionStatus, ActionCardItem[]> = {
      todo: [],
      in_progress: [],
      completed: [],
    };
    if (state.status !== "ready") return byStatus;
    const filtered = applySort(
      applyFilters(state.data.cards, filters, storage.getStatus),
      filters.sort,
      filters.direction,
    );
    for (const card of filtered) {
      const s = storage.getStatus(card.id);
      byStatus[s].push(card);
    }
    return byStatus;
  }, [state, storage, filters]);

  const isFiltered = useMemo(
    () =>
      filters.query !== "" ||
      filters.priority !== "all" ||
      filters.category !== "all" ||
      filters.difficulty !== "all" ||
      filters.status !== "all",
    [filters],
  );

  const availableCategories = useMemo(() => {
    if (state.status !== "ready") return [];
    return Array.from(new Set(state.data.cards.map((c) => c.categoryKey)));
  }, [state]);

  const totalAcrossStatuses =
    groups.todo.length + groups.in_progress.length + groups.completed.length;

  const currentScore = scoresQuery.data?.summary?.score ?? null;
  const dna = dnaQuery.data ?? null;

  const openCard = useMemo(() => {
    if (!openCardId) return null;
    if (state.status !== "ready") return null;
    return state.data.cards.find((c) => c.id === openCardId) ?? null;
  }, [openCardId, state]);

  const openCardStatus: ActionStatus = openCardId
    ? storage.getStatus(openCardId)
    : "todo";

  // Stable handler — KanbanColumn calls this on drop.
  const handleDrop = useCallback(
    (cardId: string, target: ActionStatus) => {
      storage.setStatus(cardId, target);
    },
    [storage],
  );

  if (state.status === "loading") {
    return (
      <PageContainer width="wide">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DashboardSkeleton rows={2} />
          <DashboardSkeleton rows={2} />
          <DashboardSkeleton rows={2} />
          <DashboardSkeleton rows={4} />
          <DashboardSkeleton rows={4} />
          <DashboardSkeleton rows={4} />
        </div>
      </PageContainer>
    );
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="sparkles"
          title="No actions to take — yet"
          description="The rule engine did not fire any rules. As your business profile grows, recommended actions will appear here."
          actionLabel="Refresh analysis"
          onAction={() => refresh?.()}
          secondaryActionLabel="How rules work"
          onSecondaryAction={() => { if (typeof window !== "undefined") window.location.href = "/"; }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">Go to Business</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load the action board"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  const { cards, rules } = state.data;
  const total = cards.length;

  if (total === 0) {
    return (
      <PageContainer width="wide">
        <BoardHeader
          totalFirings={0}
          generatedAt={rules.generated_at}
          onRefresh={refresh}
          onReset={storage.clearAll}
          isRefreshing={isFetching}
        />
        <EmptyState
          title="No actions to take — yet"
          description="The rule engine did not fire any rules. As your business profile grows, recommended actions will appear here."
          icon={<Sparkles className="size-6" aria-hidden="true" />}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide">
      <BoardHeader
        totalFirings={total}
        generatedAt={rules.generated_at}
        onRefresh={refresh}
        onReset={storage.clearAll}
        isRefreshing={isFetching}
      />

      <div className="mb-4 flex flex-col gap-3">
        <BoardControls
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
          isFiltered={isFiltered}
          totalCards={total}
          visibleCards={totalAcrossStatuses}
        />
        <BoardSummaryPanel
          cards={cards}
          statuses={storage.all}
          currentScore={currentScore}
        />
        <BusinessJourneyPreview
          dna={dna}
          cards={cards}
          statuses={storage.all}
          currentScore={currentScore}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {`${groups.todo.length} ${STATUS_LABELS.todo}, ${groups.in_progress.length} ${STATUS_LABELS.in_progress}, ${groups.completed.length} ${STATUS_LABELS.completed}`}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KanbanColumn
          status="todo"
          title="To Do"
          caption="Not started"
          cards={groups.todo}
          resolveStatus={storage.getStatus}
          onDrop={handleDrop}
          onCardOpen={setOpenCardId}
        />
        <KanbanColumn
          status="in_progress"
          title="In Progress"
          caption="Working on it"
          cards={groups.in_progress}
          resolveStatus={storage.getStatus}
          onDrop={handleDrop}
          onCardOpen={setOpenCardId}
        />
        <KanbanColumn
          status="completed"
          title="Completed"
          caption="Done"
          cards={groups.completed}
          resolveStatus={storage.getStatus}
          onDrop={handleDrop}
          onCardOpen={setOpenCardId}
        />
      </div>

      <SlideOver
        open={openCard !== null}
        onClose={() => setOpenCardId(null)}
        title={openCard?.title ?? ""}
        description={
          openCard
            ? `${openCard.category} · ${PRIORITY_LABELS[openCard.priority]}`
            : undefined
        }
      >
        {openCard && (
          <ActionDetailsPanel
            card={openCard}
            status={openCardStatus}
            onChangeStatus={(next) => {
              storage.setStatus(openCard.id, next);
            }}
            relatedArticleIds={openCard.relatedArticleIds}
            hasAiBacking={openCard.hasAiBacking}
            aiConfidence={openCard.aiConfidence}
          />
        )}
      </SlideOver>
    </PageContainer>
  );
}

interface BoardHeaderProps {
  totalFirings: number;
  generatedAt: string;
  onRefresh: () => void;
  onReset: () => void;
  isRefreshing?: boolean;
}

/**
 * Slim header for the action board. Keeps the page footer
 * (load timestamps, reset button) out of the columns.
 */
function BoardHeader({
  totalFirings,
  generatedAt,
  onRefresh,
  onReset,
  isRefreshing = false,
}: BoardHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sprint 4 · Action Board
        </p>
        <h1 className="truncate text-2xl font-semibold text-foreground">
          Interactive Action Board
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {totalFirings} action{totalFirings === 1 ? "" : "s"} from the rule
          engine · last generated {formatTimestamp(generatedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          aria-label="Reset all card statuses to To Do"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset board
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={
            isRefreshing
              ? "Refreshing action board"
              : "Refresh action board from the rule engine"
          }
        >
          <RefreshCw
            className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRefreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
