/**
 * AI Business Assistant — Sprint 7 Part 1 + Part 3 (minimal).
 *
 * Frontend only. The page composes a chat layout that
 * reads the existing Twin, Recommendations, Roadmap,
 * Rules, and Insights payloads and assembles a
 * deterministic response locally. There is no LLM
 * provider call, no streaming, and no memory.
 *
 * Sprint 7 Part 3 adds an opt-in server-side history
 * sidebar (ChatSessionsList). When the user toggles
 * "Server history" on, the conversation is persisted via
 * /api/v1/chat and the assistant calls the backend
 * provider. When the toggle is off, the local Part 1
 * builder is used unchanged.
 *
 * Top-level view that composes the chat layout:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Header (title + refresh + clear + history) │
 *   ├──────────────────────────┬──────────────────┤
 *   │  Conversation thread     │  Context Panel   │
 *   │  (scrollable)            │  (sticky)        │
 *   │                          │                  │
 *   ├──────────────────────────┴──────────────────┤
 *   │  Suggested questions                        │
 *   │  Prompt input                               │
 *   └─────────────────────────────────────────────┘
 *
 * On mobile (below lg) the context panel stacks below
 * the conversation. On lg+ it sits as a 320-px rail on
 * the right. The conversation region is the only area
 * that scrolls; the suggested-questions + prompt bar
 * stick to the bottom of the chat column.
 *
 * State machine: loading / no-business / error / ready.
 * The same four states every other analytics surface in
 * the app uses.
 */

"use client";

import Link from "next/link";
import { ArrowRight, Building2, History, Sparkles } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import { AssistantHeader } from "./AssistantHeader";
import { ChatSessionsList } from "./ChatSessionsList";
import { ConversationList } from "./ConversationList";
import { ContextPanel } from "./ContextPanel";
import { PromptInput } from "./PromptInput";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { SmartFollowUps } from "./SmartFollowUps";
import { ConversationToolbar } from "./ConversationToolbar";
import { useAssistantData } from "./use-assistant-data";
import { chatService, type ChatMessageOut } from "@/services";
import { cn } from "@/lib/utils";
import type { ChatMessage as LocalChatMessage, ChatSource as LocalChatSource } from "./types";

/**
 * Project a server-side message into the Part 1 ChatMessage
 * shape the existing ConversationList expects. The Part 1
 * component is intentionally unaware of the server-side
 * history feature; we keep the two worlds decoupled by
 * translating at the boundary.
 */
function toLocalMessage(m: ChatMessageOut): LocalChatMessage {
  return {
    id: String(m.id),
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
    sources: (m.sources || []).map((s) => ({
      topic: s.topic as LocalChatSource["topic"],
      detail: s.detail,
    })),
    kind: undefined,
  };
}

export function AssistantView() {
  const {
    state,
    isFetching,
    refresh,
    suggestedQuestions,
    conversation,
    submit,
    submitSuggested,
    clear,
    isThinking,
    smartFollowUps,
    memoryTopics,
    exportConversation,
    searchConversation,
  } = useAssistantData();

  // Sprint 7 Part 3 (minimal): server-side history toggle.
  // When off, the page renders the local-first Part 1 chat
  // unchanged. When on, the user sees a sidebar of server
  // conversations + the prompt submissions go to the
  // backend via /api/v1/chat.
  const [serverHistory, setServerHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverMessages, setServerMessages] = useState<ChatMessageOut[]>([]);

  // When server-history is off, the local-first path
  // supplies the thread. When on, the server replies
  // supply the thread.
  const visibleMessages: LocalChatMessage[] = serverHistory
    ? serverMessages.map(toLocalMessage)
    : conversation.messages;

  const handleServerNew = async () => {
    if (serverLoading) return;
    setServerLoading(true);
    setServerError(null);
    try {
      const detail = await chatService.createSession("");
      setActiveSessionId(detail.id);
      setServerMessages(detail.messages);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Could not start a new conversation.",
      );
    } finally {
      setServerLoading(false);
    }
  };

  const handleServerResume = async (sessionId: number) => {
    if (serverLoading) return;
    setServerLoading(true);
    setServerError(null);
    try {
      const detail = await chatService.getSession(sessionId);
      setActiveSessionId(detail.id);
      setServerMessages(detail.messages);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Could not resume that conversation.",
      );
    } finally {
      setServerLoading(false);
    }
  };

  const handleServerClear = () => {
    // "Clear conversation" in the server-history mode deletes
    // the active session on the server and resets the local
    // thread. This matches the semantics of the Part 1 "Clear
    // Chat" button so the user-visible behaviour is the same.
    if (activeSessionId !== null) {
      void chatService.deleteSession(activeSessionId).catch(() => {
        /* swallow — surface server-side errors via the sidebar */
      });
    }
    setActiveSessionId(null);
    setServerMessages([]);
  };

  const handleServerSubmit = async (prompt: string) => {
    if (serverLoading) return;
    setServerError(null);
    // First message without a session -> create one.
    let sessionId = activeSessionId;
    if (sessionId === null) {
      try {
        const detail = await chatService.createSession("");
        sessionId = detail.id;
        setActiveSessionId(detail.id);
      } catch (err) {
        setServerError(
          err instanceof Error ? err.message : "Could not start a conversation.",
        );
        return;
      }
    }
    setServerLoading(true);
    try {
      const resp = await chatService.appendMessage(sessionId, prompt);
      setActiveSessionId(resp.session.id);
      setServerMessages([resp.user_message, resp.assistant_message]);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Could not send that message.",
      );
    } finally {
      setServerLoading(false);
    }
  };

  if (state.status === "loading") {
    return (
      <PageContainer width="wide">
        <div className="flex flex-col gap-4">
          <DashboardSkeleton rows={2} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <DashboardSkeleton rows={6} />
            <DashboardSkeleton rows={6} />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "no-business") {
    return (
      <PageContainer width="wide">
        <EmptyState
          illustration="building"
          title="No business profile yet"
          description={state.detail ||
            "Set up your business profile to chat with the AI Business Assistant."
          }
          actionLabel="Create business profile"
          onAction={() => { if (typeof window !== "undefined") window.location.href = "/business"; }}
          secondaryActionLabel="Learn more"
          onSecondaryAction={() => { if (typeof window !== "undefined") window.location.href = "/"; }}
        />
        <div className="mt-4 flex items-center justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/business">
              Go to Business
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer width="wide">
        <ErrorState
          title="Could not load assistant data"
          description={state.detail}
          actionLabel="Try again"
          onAction={refresh}
        />
      </PageContainer>
    );
  }

  // Ready.
  const { context, bundle } = state;
  const lastAnalyzedAt =
    bundle.twin.last_analysis_at ||
    bundle.twin.generated_at ||
    bundle.decision?.generated_at ||
    null;
  const hasMessages = visibleMessages.length > 0;
  const isBusy = isThinking || serverLoading;
  const visibleConversation = {
    id:
      serverHistory && activeSessionId !== null
        ? String(activeSessionId)
        : conversation.id,
    messages: visibleMessages,
    lastMessageAt:
      visibleMessages.length > 0
        ? visibleMessages[visibleMessages.length - 1].createdAt
        : null,
  };

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4">
        <AssistantHeader
          lastAnalyzedAt={lastAnalyzedAt}
          isFetching={isFetching}
          onRefresh={refresh}
          onClear={serverHistory ? handleServerClear : clear}
          messageCount={visibleMessages.length}
          rightSlot={
            <Button
              type="button"
              size="sm"
              variant={serverHistory ? "default" : "outline"}
              onClick={() => {
                setServerHistory((prev) => !prev);
                setServerError(null);
              }}
              aria-pressed={serverHistory}
              aria-label="Toggle server-side history"
            >
              <History className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {serverHistory ? "Server history on" : "Server history"}
              </span>
            </Button>
          }
        />

        {serverError && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {serverError}
          </p>
        )}

        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            serverHistory
              ? "lg:grid-cols-[280px_minmax(0,1fr)_320px]"
              : "lg:grid-cols-[minmax(0,1fr)_320px]",
          )}
        >
          {serverHistory && (
            <aside
              aria-label="Server-side conversations"
              className="lg:sticky lg:top-4 lg:self-start"
            >
              <ChatSessionsList
                onResume={handleServerResume}
                onNew={handleServerNew}
                activeSessionId={activeSessionId}
              />
            </aside>
          )}

          <section
                      aria-label="Assistant conversation"
                      className="flex h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft"
                    >
                      <ConversationToolbar
                        conversation={visibleConversation}
                        search={searchConversation}
                        exportConversation={exportConversation}
                        businessName={bundle.twin.identity.legal_name}
                      />
                      <ConversationList
                        conversation={visibleConversation}
                        isThinking={isBusy}
                        hasMessages={hasMessages}
                        memoryTopics={memoryTopics}
                        onFollowUp={(label) => submit(label)}
                      />
                      <div className="flex flex-col gap-3 border-t border-border bg-background/30 p-3 sm:p-4">
                        <SmartFollowUps
                          followUps={smartFollowUps}
                          onSelect={(f) => submit(f.prompt)}
                          disabled={isBusy}
                        />
                        <SuggestedQuestions
                          questions={suggestedQuestions}
                          onSelect={submitSuggested}
                          disabled={isBusy}
                        />
                        <PromptInput
                          onSubmit={serverHistory ? handleServerSubmit : submit}
                          disabled={isBusy}
                          placeholder={
                            isBusy
                              ? "Composing answer…"
                              : "Ask about your business…"
                          }
                        />
                      </div>
                    </section>

          <aside
            aria-label="Business context"
            className="lg:sticky lg:top-4 lg:self-start"
          >
            <ContextPanel context={context} />
          </aside>
        </div>

        <p className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3 text-primary" aria-hidden="true" />
          {serverHistory
            ? "Server history on. Responses come from the backend provider."
            : "No LLM. Every answer is built locally from the same five payloads the dashboard reads."}
        </p>
      </div>
    </PageContainer>
  );
}
