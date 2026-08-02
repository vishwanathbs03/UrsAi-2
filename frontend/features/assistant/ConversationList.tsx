/**
 * Scrollable conversation thread. Auto-scrolls to the
 * newest message whenever a new one is appended. Renders
 * a typing indicator while the assistant is composing
 * (the spec says "no streaming", so the indicator is the
 * only feedback between submit and reply).
 */

"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, LineChart, ListChecks, Map, Plus, Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversation: Conversation;
  isThinking: boolean;
  /** True when the assistant is the only one to have spoken
   *  (used to centre the empty-state greeting). */
  hasMessages: boolean;
  /** Topics the consultant has already answered in this session. */
  memoryTopics?: string[];
  /** Called when the user clicks a smart follow-up chip. */
  onFollowUp?: (label: string) => void;
}

export function ConversationList({
  conversation,
  isThinking,
  hasMessages,
  memoryTopics,
  onFollowUp,
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
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center text-muted-foreground">
        <div className="relative flex size-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl"
          />
          <Sparkles className="size-7" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-foreground">
            Your McKinsey-grade business consultant.
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask anything about your business. The assistant reads the same data
            the dashboard, insights, action board, and analytics pages read —
            so every answer is grounded in the current analysis.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              icon: <LineChart className="size-3.5" aria-hidden="true" />,
              label: "Improve my business",
            },
            {
              icon: <ListChecks className="size-3.5" aria-hidden="true" />,
              label: "Explain recommendations",
            },
            {
              icon: <Map className="size-3.5" aria-hidden="true" />,
              label: "Walk through the roadmap",
            },
            {
              icon: <Plus className="size-3.5" aria-hidden="true" />,
              label: "How do I grow revenue?",
            },
          ].map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-[11px] font-medium text-foreground"
            >
              {s.icon}
              {s.label}
              <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
            </span>
          ))}
        </div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Pick a suggestion below or type your own.
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
        <MessageBubble
          key={m.id}
          message={m}
          memoryTopics={memoryTopics}
          onFollowUp={onFollowUp}
        />
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
