/**
 * QuickActions — the hackathon-demo quick-action bar pinned below
 * the KPI strip. Three buttons:
 *   Analyze Again   -> /analysis (re-runs the demo pipeline)
 *   View Report     -> /reports
 *   Ask AI          -> /assistant
 *
 * All three use Next.js client-side navigation (router.push), no
 * full-page reload. Buttons fall back to <Link> when onAction is
 * not provided, so the component can also be dropped in any
 * other context that just wants the visual band.
 */

"use client";

import {
  Bot,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  /** Override the default route for "Analyze Again". */
  onAnalyzeAgain?: () => void;
  /** Override the default route for "View Report". */
  onViewReport?: () => void;
  /** Override the default route for "Ask AI". */
  onAskAi?: () => void;
  className?: string;
}

export function QuickActions({
  onAnalyzeAgain,
  onViewReport,
  onAskAi,
  className,
}: QuickActionsProps) {
  const router = useRouter();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-soft",
        className,
      )}
      role="toolbar"
      aria-label="Quick actions"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
        Quick Actions
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={onAnalyzeAgain ?? (() => router.push("/analysis"))}
        >
          <RefreshCcw className="size-4" aria-hidden="true" />
          Analyze Again
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onViewReport ?? (() => router.push("/reports"))}
        >
          <FileText className="size-4" aria-hidden="true" />
          View Report
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onAskAi ?? (() => router.push("/assistant"))}
        >
          <Bot className="size-4" aria-hidden="true" />
          Ask AI
        </Button>
      </div>
    </div>
  );
}
