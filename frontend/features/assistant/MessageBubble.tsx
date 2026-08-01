/**
 * One chat message — either a user prompt or an assistant
 * reply. The body uses plain text with paragraph splits on
 * `\n\n` and bullet splits on `\n- `. The source list under
 * assistant messages is collapsed by default and expanded
 * via a button so the chat stays scannable.
 */

"use client";

import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageModel } from "./types";

interface MessageBubbleProps {
  message: ChatMessageModel;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article
      aria-label={isUser ? "Your message" : "Assistant message"}
      className={cn(
        "flex w-full gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border",
          isUser
            ? "border-border bg-secondary text-secondary-foreground"
            : "border-primary/30 bg-primary/10 text-primary",
        )}
      >
        {isUser ? (
          <User className="size-4" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </div>
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "relative group rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-soft",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-card-foreground",
          )}
        >
          <FormattedBody text={message.content} />
          {!isUser && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] flex items-center gap-1"
              title="Copy message"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceList sources={message.sources} />
        )}
        <time
          dateTime={message.createdAt}
          className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          {formatTime(message.createdAt)}
        </time>
      </div>
    </article>
  );
}

// --------------------------------------------------------------------------- //
// Internal — body formatting
// --------------------------------------------------------------------------- //

function FormattedBody({ text }: { text: string }) {
  // Split on `\n\n` for paragraphs, then on `\n- ` for bullet lists.
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-2">
      {paragraphs.map((para, pi) => {
        const lines = para.split(/\n/);
        const isBulletBlock =
          lines.length > 1 &&
          lines.every((l) => l.startsWith("- ") || l.trim() === "");
        if (isBulletBlock) {
          return (
            <ul key={pi} className="ml-4 list-disc space-y-1">
              {lines
                .filter((l) => l.startsWith("- "))
                .map((l, li) => (
                  <li key={li}>{l.slice(2)}</li>
                ))}
            </ul>
          );
        }
        return <p key={pi}>{para}</p>;
      })}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Internal — source list
// --------------------------------------------------------------------------- //

function SourceList({
  sources,
}: {
  sources: NonNullable<ChatMessageModel["sources"]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`sources-${sources[0]?.topic ?? "x"}`}
        className="inline-flex w-fit items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3" aria-hidden="true" />
        )}
        {open ? "Hide sources" : `Sources (${sources.length})`}
      </button>
      {open && (
        <ul className="flex flex-col gap-1 text-foreground/80">
          {sources.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <Bot className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="font-medium">{s.topic}</span> — {s.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Internal — timestamp helper
// --------------------------------------------------------------------------- //

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
