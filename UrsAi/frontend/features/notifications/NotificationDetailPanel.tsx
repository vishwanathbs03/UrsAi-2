"use client";

import {
  Check,
  CheckCheck,
  Lightbulb,
  ListChecks,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/common/SlideOver";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import { NOTIFICATION_CATEGORIES } from "./use-notification-filters";
import type { NotificationItem } from "./use-notifications-data";

interface NotificationDetailPanelProps {
  notification: NotificationItem | null;
  isRead: boolean;
  onClose: () => void;
  onToggleRead: (id: string) => void;
}

/**
 * Slide-over detail panel for a single notification. Reuses
 * the existing SlideOver primitive (no new dep). Shows the
 * full summary, the upstream source key, the related
 * recommendation / roadmap / rule, and the mark-as-read
 * toggle.
 */
export function NotificationDetailPanel({
  notification,
  isRead,
  onClose,
  onToggleRead,
}: NotificationDetailPanelProps) {
  const open = notification !== null;
  const categoryLabel = notification
    ? NOTIFICATION_CATEGORIES.find((c) => c.key === notification.category)
        ?.label ?? notification.category
    : "";

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={notification?.title ?? "Notification detail"}
      description={
        notification
          ? `${categoryLabel} · ${notification.priority} priority · ${formatTimestamp(notification.timestamp)}`
          : ""
      }
      width={480}
    >
      {notification && (
        <div className="flex flex-col gap-4">
          <section
            aria-label="Overview"
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <LevelBadge
                level={notification.priority}
                tone={levelToTone(notification.priority)}
              />
              <span
                className={
                  isRead
                    ? "inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    : "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
                }
                aria-label={isRead ? "Read" : "Unread"}
              >
                {isRead ? (
                  <CheckCheck className="size-3" aria-hidden="true" />
                ) : (
                  <Check className="size-3" aria-hidden="true" />
                )}
                {isRead ? "Read" : "Unread"}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {notification.summary}
            </p>
          </section>

          <section
            aria-label="Related rule"
            className="flex flex-col gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Related rule
            </p>
            {notification.relatedRule ? (
              <RelatedCard
                icon={
                  <ListChecks
                    className="size-3.5"
                    aria-hidden="true"
                  />
                }
                title={notification.relatedRule.title}
                subtitle={`${notification.relatedRule.priority} · ${notification.relatedRule.category}`}
                badge={
                  <LevelBadge
                    level={notification.relatedRule.priority}
                    tone={levelToTone(notification.relatedRule.priority)}
                  />
                }
              />
            ) : (
              <EmptyHint text="No rule linked to this notification." />
            )}
          </section>

          <section
            aria-label="Related recommendation"
            className="flex flex-col gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Related recommendation
            </p>
            {notification.relatedRecommendation ? (
              <RelatedCard
                icon={
                  <Lightbulb className="size-3.5" aria-hidden="true" />
                }
                title={notification.relatedRecommendation.title}
                subtitle={`${notification.relatedRecommendation.phase} · est. ROI ${notification.relatedRecommendation.estimated_roi}%`}
                badge={
                  <LevelBadge
                    level={notification.relatedRecommendation.priority}
                    tone={levelToTone(
                      notification.relatedRecommendation.priority,
                    )}
                  />
                }
              />
            ) : (
              <EmptyHint text="No recommendation linked to this notification." />
            )}
          </section>

          <section
            aria-label="Related roadmap item"
            className="flex flex-col gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Related roadmap item
            </p>
            {notification.relatedRoadmapItem ? (
              <RelatedCard
                icon={<Map className="size-3.5" aria-hidden="true" />}
                title={notification.relatedRoadmapItem.title}
                subtitle={`${notification.relatedRoadmapItem.phase} · ${notification.relatedRoadmapItem.completion_percentage}% complete`}
                badge={
                  <LevelBadge
                    level={notification.relatedRoadmapItem.priority}
                    tone={levelToTone(notification.relatedRoadmapItem.priority)}
                  />
                }
              />
            ) : (
              <EmptyHint text="No roadmap item linked to this notification." />
            )}
          </section>

          <section
            aria-label="Source"
            className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground"
          >
            <p className="font-medium text-foreground">Source</p>
            <p>
              Generated by the{" "}
              <span className="font-mono text-foreground">
                {notification.source}
              </span>{" "}
              engine. Field pointer:{" "}
              <span className="font-mono text-foreground">
                {notification.source_key}
              </span>
              .
            </p>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleRead(notification.id)}
              aria-label={
                isRead
                  ? `Mark ${notification.title} as unread`
                  : `Mark ${notification.title} as read`
              }
            >
              {isRead ? "Mark unread" : "Mark as read"}
            </Button>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

interface RelatedCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
}

function RelatedCard({ icon, title, subtitle, badge }: RelatedCardProps) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-primary" aria-hidden="true">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-medium text-foreground">
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
      {text}
    </p>
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
