"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, Conversation } from "./types";

interface ToolbarProps {
  conversation: Conversation;
  /** Free-text search across the conversation. */
  search: (q: string) => ChatMessage[];
  /** Export helper that returns a blob URL. */
  exportConversation: (
    format: "markdown" | "json" | "text",
    legalName?: string,
  ) => { url: string; filename: string };
  businessName?: string;
}

/**
 * Top toolbar above the conversation thread.
 *
 *  - Search box that filters the visible messages locally.
 *  - Export dropdown (Markdown / JSON / Text) — pure client-side,
 *    writes a Blob to a temporary URL and triggers an anchor
 *    download, so the transcript never leaves the browser.
 */
export function ConversationToolbar({
  conversation,
  search,
  exportConversation,
  businessName,
}: ToolbarProps) {
  const [query, setQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const matches = useMemo(
    () => (query.trim().length > 0 ? search(query) : []),
    [query, search],
  );

  const hasMessages = conversation.messages.length > 0;

  const handleExport = (format: "markdown" | "json" | "text") => {
    const { url, filename } = exportConversation(format, businessName);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportOpen(false);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-background/40 px-3 py-2"
      aria-label="Conversation toolbar"
    >
      <div className="relative flex-1 min-w-[180px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversation…"
          className={cn(
            "h-8 w-full rounded-md border bg-background/60 pl-8 pr-8 text-xs transition",
            "focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30",
          )}
          aria-label="Search this conversation"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
        {query.length > 0 ? (
          <div className="pointer-events-none absolute left-0 top-full mt-1 text-[10px] text-muted-foreground">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={!hasMessages}
          onClick={() => setExportOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background/60 px-2.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
          aria-label="Export conversation"
        >
          <Download className="size-3.5" aria-hidden />
          Export
        </button>
        {exportOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border bg-card p-1 text-xs shadow-md"
          >
            {(
              [
                { fmt: "markdown", label: "Markdown (.md)", icon: <FileText className="size-3.5" /> },
                { fmt: "text", label: "Plain text (.txt)", icon: <FileText className="size-3.5" /> },
                { fmt: "json", label: "Raw JSON (.json)", icon: <FileText className="size-3.5" /> },
              ] as const
            ).map((opt) => (
              <button
                key={opt.fmt}
                type="button"
                role="menuitem"
                onClick={() => handleExport(opt.fmt)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-foreground hover:bg-muted"
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}