/**
 * Suggested-question chip row. Renders above the prompt
 * input and is keyboard-navigable. Clicking a chip routes
 * to the same code path as a typed prompt.
 */

"use client";

import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuggestedQuestion } from "./types";

interface SuggestedQuestionsProps {
  questions: readonly SuggestedQuestion[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({
  questions,
  onSelect,
  disabled,
}: SuggestedQuestionsProps) {
  return (
    <div
      role="list"
      aria-label="Suggested questions"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Lightbulb className="size-3 text-primary" aria-hidden="true" />
        Suggested
      </span>
      {questions.map((q) => (
        <button
          key={q.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(q.id)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors",
            "hover:border-primary/40 hover:bg-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {q.text}
        </button>
      ))}
    </div>
  );
}
