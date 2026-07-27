/**
 * Scrollable conversation thread. Auto-scrolls to the
 * newest message whenever a new one is appended. Renders
 * a small typing indicator while the assistant is composing
 * (the spec says "no streaming", so the indicator is the
 * only feedback between submit and reply).
 */

"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversation: Conversation;
  isThinking: boolean;
  /** True when the assistant is the only one to have spoken
   *  (used to centre the empty-state greeting). */
  hasMessages: boolean;
}

export function ConversationList({
  conversation,
  isThinking,
  hasMessages,
}: ConversationListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on every new message — but only
  // when the user is already near the bottom, so reading
  // history is not yanked away.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 200) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [conversation.messages.length, isThinking]);

  if (!hasMessages) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center text-muted-foreground">
        <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          AI Business Assistant
        </h3>
        <p className="max-w-sm text-sm">
          Ask anything about your business. I read the same data the dashboard,
          insights, action board, and analytics pages read — so every answer
          is grounded in the current analysis.
        </p>
        <p className="text-xs">
          Try one of the suggested questions below, or type your own.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-6"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Assistant conversation"
    >
      {conversation.messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isThinking && <ThinkingIndicator />}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-primary" />
        <span
          className="size-1.5 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="size-1.5 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: "240ms" }}
        />
      </span>
      Composing answer…
    </div>
  );
}
