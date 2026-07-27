"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_SECTIONS, type ReportSectionKey } from "./sections";

interface ReportSidebarProps {
  className?: string;
}

/**
 * Sticky table-of-contents sidebar.
 *
 * Lists every report section as a jump link. Uses an
 * IntersectionObserver to highlight the section currently
 * in view, so the user can see where they are as they scroll.
 *
 * Hidden on print via the `.report-no-print` class; the
 * PrintStyles component's @media print block flips display
 * to none.
 */
export function ReportSidebar({ className }: ReportSidebarProps) {
  const [activeKey, setActiveKey] = useState<ReportSectionKey | null>(
    REPORT_SECTIONS[0]?.key ?? null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const elements = REPORT_SECTIONS.map((s) => ({
      key: s.key,
      el: document.getElementById(s.id),
    })).filter(
      (entry): entry is { key: ReportSectionKey; el: HTMLElement } =>
        entry.el !== null,
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose top is closest to the
        // top of the viewport — the section the user
        // is actually reading.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length === 0) return;
        const topEl = visible[0].target as HTMLElement;
        const found = elements.find((e) => e.el === topEl);
        if (found) setActiveKey(found.key);
      },
      {
        // Treat the upper third of the viewport as the
        // "active" band. -80px accounts for the sticky
        // app navbar.
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      },
    );

    for (const { el } of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Report sections"
      className={cn(
        "report-no-print sticky top-24 hidden h-fit max-h-[calc(100vh-7rem)] w-64 shrink-0 flex-col gap-3 self-start overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-soft lg:flex",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <List className="size-4 text-muted-foreground" aria-hidden="true" />
        On this page
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {REPORT_SECTIONS.map((s, idx) => {
          const isActive = activeKey === s.key;
          return (
            <li key={s.key}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </span>
                <span className="leading-snug">{s.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
