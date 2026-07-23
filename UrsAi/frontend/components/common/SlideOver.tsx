"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional sub-label under the title. */
  description?: string;
  /** Custom width in pixels. Default 420. */
  width?: number;
  /** A11y label for the close button. Default "Close". */
  closeLabel?: string;
  children: React.ReactNode;
}

/**
 * Right-edge slide-over panel. Built without a portal
 * library — the panel renders inline and uses a fixed
 * positioning context to cover the page. The backdrop is
 * a sibling that fades in.
 *
 * Accessibility:
 *  - role="dialog" + aria-modal="true" + aria-labelledby
 *  - focus is moved to the panel on open, restored on close
 *  - Escape closes the panel
 *  - Tab focus is trapped within the panel (simple loop)
 *  - The body is locked while the panel is open
 *
 * Why a custom implementation: shadcn doesn't ship a
 * `Sheet` primitive in this repo, and the spec says
 * "no new dep" — so a small hand-rolled version beats
 * pulling in @radix-ui/react-dialog (~30 kB) for one
 * surface.
 */
export function SlideOver({
  open,
  onClose,
  title,
  description,
  width = 420,
  closeLabel = "Close",
  children,
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: remember the element that was
  // focused when we opened, focus the panel on open,
  // restore on close.
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      lastFocusRef.current?.focus?.();
    };
  }, [open]);

  // Escape + focus trap.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
        tabIndex={-1}
        style={{ width }}
        className={cn(
          "relative ml-auto flex h-full flex-col bg-card text-card-foreground shadow-2xl",
          "animate-slideInRight outline-none",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 flex-col">
            <h2
              id="slide-over-title"
              className="truncate text-sm font-semibold text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
