"use client";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { RadarChart } from "@/components/dashboard/RadarChart";
import { LevelBadge } from "./LevelBadge";
import { levelToTone, scoreEdgeTone, scoreTone } from "./tones";
import type { BusinessScore } from "@/types/dashboard";

interface ScoresRadarCardProps {
  scores: BusinessScore[];
}

/**
 * Scores radar — the 8 business scores plotted on a single
 * radar so the user can see the business shape at a glance.
 *
 * Sprint 4: each pillar is now listed as a colour-coded row
 * below the radar so the band distribution is easy to scan
 * without reading the chart. The radar itself is unchanged
 * (one radar already covers the colour coding visually).
 */
export function ScoresRadarCard({ scores }: ScoresRadarCardProps) {
  // The radar is most readable with the 7 pillar scores (drop
  // the "overall" composite — it duplicates the other 7 and
  // muddies the shape).
  const pillars = scores.filter((s) => s.key !== "overall");
  const data = pillars.map((s) => ({
    axis: shortAxis(s.title),
    value: s.score,
  }));

  return (
    <DashboardCard
      badge="Radar"
      title="Score Profile"
      caption="One view of the seven pillar scores — the higher the better."
    >
      {data.length < 3 ? (
        <p className="text-sm text-muted-foreground">Not enough scores to plot.</p>
      ) : (
        <RadarChart data={data} ariaLabel="Business score radar" />
      )}

      {pillars.length > 0 && (
        <ul className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {pillars.map((s) => {
            const level = s.level || s.band || "Low";
            return (
              <li
                key={s.key}
                className={`flex items-center justify-between gap-2 rounded-md border border-border border-l-4 ${scoreEdgeTone(level)} bg-secondary/30 px-2.5 py-1.5`}
              >
                <span className="truncate text-xs font-medium text-foreground">
                  {s.title}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold tabular-nums ${scoreTone(level)}`}>
                    {s.score}
                  </span>
                  <LevelBadge level={level} tone={levelToTone(level)} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

function shortAxis(title: string): string {
  // Trim the "Score" suffix and title-case the axis label.
  const trimmed = title.replace(/\s*score\s*$/i, "").trim();
  if (!trimmed) return title;
  if (trimmed.length <= 12) return trimmed;
  return trimmed.slice(0, 11);
}
