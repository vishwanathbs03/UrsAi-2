"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { EmptyState } from "@/components/common/EmptyState";
import { Activity, Clock } from "lucide-react";

export interface ActivityItem {
  id?: string;
  title: string;
  timestamp?: string;
  category?: string;
}

export interface RecentActivityCardProps {
  activities?: ActivityItem[];
}

export function RecentActivityCard({ activities = [] }: RecentActivityCardProps) {
  return (
    <DashboardCard
      badge="Activity"
      title="Recent Activity"
      caption="Audit trail of business updates, analysis runs, and profile edits."
    >
      {activities.length === 0 ? (
        <EmptyState
          illustration="inbox"
          title="No recent business activity yet."
          description="Updates from profile edits, intelligence runs, and report exports will appear here as you use the platform."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {activities.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between rounded-md border border-border/50 bg-card p-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.title}</span>
              </div>
              {item.timestamp && (
                <span className="flex items-center gap-1 font-mono text-muted-foreground">
                  <Clock className="size-3" />
                  {item.timestamp}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
