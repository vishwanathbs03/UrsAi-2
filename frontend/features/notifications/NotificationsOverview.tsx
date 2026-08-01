"use client";

import { useId } from "react";
import { Bell, Sparkles, Map, Lightbulb, ShieldAlert } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { LevelBadge } from "@/features/dashboard/LevelBadge";
import { levelToTone } from "@/features/dashboard/tones";
import type { NotificationsData } from "./use-notifications-data";
import { countByCategory } from "./use-notification-filters";

interface NotificationsOverviewProps {
  data: NotificationsData;
  unreadCount: number;
}

/**
 * Notifications Center Overview — five KPI tiles:
 *  - Total
 *  - Unread
 *  - Critical
 *  - Recommendations
 *  - Roadmap Updates
 *
 * Every value is read straight from the upstream-derived
 * notification feed. No re-derivation.
 */
export function NotificationsOverview({
  data,
  unreadCount,
}: NotificationsOverviewProps) {
  const counts = countByCategory(data.notifications);
  const total = data.notifications.length;
  const criticalCount = counts.critical;
  const recCount = counts.recommendation;
  const roadmapCount = counts.roadmap;

  return (
    <div
      role="region"
      aria-label="Notifications overview"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <OverviewTile
        icon={<Bell className="size-4" aria-hidden="true" />}
        badge="Total"
        title="Total notifications"
        value={total}
        caption={
          total === 0
            ? "Engine has not produced any events yet"
            : "from rules, recommendations, roadmap, and twin"
        }
      />
      <OverviewTile
        icon={<Bell className="size-4" aria-hidden="true" />}
        badge="Unread"
        title="Unread"
        value={unreadCount}
        caption={
          unreadCount === 0
            ? "All caught up"
            : `${unreadCount} pending review`
        }
        tone={
          unreadCount === 0
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-800"
        }
      />
      <OverviewTile
        icon={<ShieldAlert className="size-4" aria-hidden="true" />}
        badge="Critical"
        title="Critical"
        value={criticalCount}
        caption={
          criticalCount === 0
            ? "No critical rule firings"
            : "Immediate attention required"
        }
        tone={levelToTone("Critical")}
      />
      <OverviewTile
        icon={<Lightbulb className="size-4" aria-hidden="true" />}
        badge="Recommendations"
        title="Recommendations"
        value={recCount}
        caption={
          recCount === 0
            ? "No new recommendations"
            : "New recommendation items"
        }
      />
      <OverviewTile
        icon={<Map className="size-4" aria-hidden="true" />}
        badge="Roadmap"
        title="Roadmap updates"
        value={roadmapCount}
        caption={
          roadmapCount === 0
            ? "No roadmap updates"
            : "Phase / progress changes"
        }
      />
    </div>
  );
}

interface OverviewTileProps {
  icon: React.ReactNode;
  badge: string;
  title: string;
  value: number;
  caption?: string;
  tone?: string;
}

function OverviewTile({
  icon,
  badge,
  title,
  value,
  caption,
  tone,
}: OverviewTileProps) {
  const id = useId();
  return (
    <DashboardCard badge={badge} title={title} compact>
      <div className="flex items-center gap-3">
        <span
          className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <span
            id={id}
            className="text-2xl font-semibold text-foreground tabular-nums"
          >
            <AnimatedCounter value={value} />
          </span>
          {caption && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {tone ? <LevelBadge level={caption} tone={tone} /> : caption}
            </span>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}
