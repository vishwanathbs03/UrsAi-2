"use client";

import type { ReactNode } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { ReportSectionMeta } from "./sections";

interface ReportSectionProps {
  meta: ReportSectionMeta;
  children: ReactNode;
  /** Optional trailing slot (e.g. a "back to top" link). */
  trailing?: ReactNode;
}

/**
 * Wrapper for every report section. Provides:
 *  - a stable anchor (`id={meta.id}`) the TOC links to
 *  - the same badge / title / caption chrome used elsewhere
 *  - a `scroll-mt-*` offset so the anchored section lands
 *    below the sticky app navbar
 */
export function ReportSection({ meta, children, trailing }: ReportSectionProps) {
  return (
    <section
      id={meta.id}
      aria-labelledby={`${meta.id}-heading`}
      className="scroll-mt-24"
    >
      <DashboardCard
        badge={meta.badge}
        title={meta.title}
        caption={meta.caption}
        trailing={trailing}
      >
        <h2 id={`${meta.id}-heading`} className="sr-only">
          {meta.title}
        </h2>
        {children}
      </DashboardCard>
    </section>
  );
}
