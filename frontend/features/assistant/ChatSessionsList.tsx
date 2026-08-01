"use client";

/**
 * ChatSessionsList - Sprint 7 Part 3 (minimal frontend).
 *
 * Sidebar widget that surfaces the server-side
 * conversations created via /api/v1/chat. Lets the user
 * resume a conversation (loads its history into the local
 * chat), delete a conversation (with a confirm), and start
 * a new server-backed conversation.
 *
 * The component is intentionally minimal:
 *
 *  * Reuses the existing DashboardCard primitive.
 *  * Reuses the existing EmptyState pattern.
 *  * No drag-and-drop, no virtualisation, no search — the
 *    brief asks for a sidebar, not a feature.
 *
 * The component is opt-in: the parent renders it next to the
 * chat column only when the user has enabled server-side
 * history. The Part 1 local-first Conversation path stays
 * the default so the Sprint 7 Part 1 assistant view is
 * untouched when the sidebar is hidden.
 */

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { chatService, type ChatSessionSummary } from "@/services";
import { cn } from "@/lib/utils";

interface ChatSessionsListProps {
  /** Called when the user clicks a session. */
  onResume: (sessionId: number) => void;
  /** Called when the user clicks "New conversation". */
  onNew: () => void;
  /** Active session id (highlighted). */
  activeSessionId: number | null;
}

export function ChatSessionsList({
  onResume,
  onNew,
  activeSessionId,
}: ChatSessionsListProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await chatService.listSessions();
      setSessions(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (sessionId: number) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this conversation?")) {
      return;
    }
    try {
      await chatService.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete session.");
    }
  };

  return (
    <DashboardCard
      badge="History"
      title="Conversations"
      caption="Server-side conversations from the AI Assistant."
      trailing={
        <Button type="button" variant="outline" size="sm" onClick={onNew}>
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New</span>
        </Button>
      }
    >
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Loading conversations…
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && sessions.length === 0 && (
        <EmptyState
          illustration="chat"
          title="No conversations yet"
          description="Click New to start a server-side conversation with the AI Business Assistant."
          actionLabel="Start a new chat"
          onAction={onNew}
        />
      )}
      {!loading && !error && sessions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <li key={s.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background/40 hover:border-primary/30 hover:bg-primary/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onResume(s.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className="block truncate font-medium text-foreground">
                      {s.title || "Untitled conversation"}
                    </span>
                    <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.message_count} message
                      {s.message_count === 1 ? "" : "s"} ·{" "}
                      {s.fallback_used ? "fallback" : s.last_model || "model"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    aria-label="Delete conversation"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}