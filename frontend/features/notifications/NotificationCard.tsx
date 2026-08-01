"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Lightbulb,
  ListChecks,
  Map,
  ShieldAlert,
} from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CATEGORIES } from "./use-notification-filters";
import type { NotificationItem } from "./use-notifications-data";

interface NotificationCardProps {
  notification: NotificationItem;
  isRead: boolean;
  onOpen: (notification: NotificationItem) => void;
  /** Toggle the read state of the given id. The caller
   *  decides which direction to go (the card just signals
   *  the user's intent to flip). */
  onToggleRead: (id: string) => void;
}

/**
 * One notification card. Surfaces every field the spec
 * named (title, summary, category, priority, timestamp,
 * status, related recommendation, related roadmap item,
 * related rule) using the existing card / badge / level-tone
 * primitives. Click anywhere on the card body to open the
 * detail slide-over.
 *
 * Unread state: the card has a left-rail accent and a
 * subtle background wash. Read state: flat, no rail. This
 * is the same visual rhythm as the score-card edge tone
 * (features/dashboard/tones.ts) — no new design system.
 */
export function NotificationCard({
  notification,
  isRead,
  onOpen,
  onToggleRead,
}: NotificationCardProps) {
  const [busy, setBusy] = useState(false);
  const categoryLabel =
    NOTIFICATION_CATEGORIES.find((c) => c.key === notification.category)
      ?.label ?? notification.category;
  const isCritical = notification.priority === "Critical";

  function handleToggleRead(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    onToggleRead(notification.id);
    // Re-enable after a microtask so the user can't double-click.
    Promise.resolve().then(() => setBusy(false));
  }

  return (
    <DashboardCard
      badge={categoryLabel}
      title={notification.title}
      compact
      className={cn(
        "transition-colors",
        !isRead && "border-l-4",
        !isRead && isCritical && "border-l-rose-500 bg-rose-50/30",
        !isRead && !isCritical && "border-l-primary bg-primary/5",
        isRead && "opacity-80",
      )}
      trailing={
        <div className="flex items-center gap-1.5">
          <LevelBadge
            level={notification.priority}
            tone={levelToTone(notification.priority)}
          />
          {isRead ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              aria-label="Read"
            >
              <CheckCheck className="size-3" aria-hidden="true" />
              Read
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
              aria-label="Unread"
            >
              <Bell className="size-3" aria-hidden="true" />
              Unread
            </span>
          )}
        </div>
      }
    >
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="block w-full text-left text-sm leading-relaxed text-foreground"
      >
        {notification.summary}
      </button>

      {(notification.relatedRecommendation ||
        notification.relatedRoadmapItem ||
        notification.relatedRule) && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
          {notification.relatedRule && (
            <div className="flex items-start gap-2">
              <ListChecks
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Related rule
                </span>
                <span className="truncate text-foreground">
                  {notification.relatedRule.title}
                </span>
              </div>
            </div>
          )}
          {notification.relatedRecommendation && (
            <div className="flex items-start gap-2">
              <Lightbulb
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Related recommendation
                </span>
                <span className="truncate text-foreground">
                  {notification.relatedRecommendation.title}
                </span>
              </div>
            </div>
          )}
          {notification.relatedRoadmapItem && (
            <div className="flex items-start gap-2">
              <Map
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Related roadmap item
                </span>
                <span className="truncate text-foreground">
                  {notification.relatedRoadmapItem.title}{" "}
                  <span className="text-muted-foreground">
                    ({notification.relatedRoadmapItem.phase})
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="mr-1 inline-block size-3" aria-hidden="true" />
          {notification.source} · {formatTimestamp(notification.timestamp)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleRead}
            disabled={busy}
            aria-label={
              isRead
                ? `Mark ${notification.title} as unread`
                : `Mark ${notification.title} as read`
            }
          >
            <Check className="size-3.5" aria-hidden="true" />
            {isRead ? "Mark unread" : "Mark read"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpen(notification)}
            aria-label={`View detail for ${notification.title}`}
          >
            View detail
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}

function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
