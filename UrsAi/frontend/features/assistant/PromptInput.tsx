/**
 * Prompt input row at the bottom of the conversation.
 * Multi-line capable up to 4 rows, then scrolls. Submits
 * on Enter (without Shift) and inserts a newline on
 * Shift+Enter — the same convention every chat UI uses.
 *
 * Disabled while the assistant is composing so a user
 * cannot enqueue two prompts in flight. The "Clear chat"
 * button lives in the header; this row is just the
 * composer.
 */

"use client";

import { forwardRef, useCallback, useState, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  function PromptInput(
    { onSubmit, disabled, placeholder = "Ask about your business…" },
    ref,
  ) {
    const [value, setValue] = useState("");

    const submit = useCallback(() => {
      const trimmed = value.trim();
      if (trimmed.length === 0 || disabled) return;
      onSubmit(trimmed);
      setValue("");
    }, [value, onSubmit, disabled]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      },
      [submit],
    );

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex w-full items-end gap-2"
        aria-label="Send a prompt"
      >
        <label htmlFor="assistant-prompt" className="sr-only">
          Prompt
        </label>
        <textarea
          id="assistant-prompt"
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          aria-label="Ask the assistant"
          className={cn(
            "min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-soft placeholder:text-muted-foreground",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          aria-label="Send prompt"
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition-colors",
            "hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    );
  },
);
