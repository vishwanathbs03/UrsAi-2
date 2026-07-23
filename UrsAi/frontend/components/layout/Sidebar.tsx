"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";
import { isActiveLink, mainNavLinks } from "@/lib/navigation";

interface SidebarProps {
  className?: string;
}

/**
 * Desktop-only fixed sidebar. Renders nothing on mobile/tablet so the
 * Navbar + MobileDrawer take over there.
 */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname() ?? "/";

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-30 lg:border-r lg:border-border lg:bg-background",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link
          href="/"
          aria-label="Atlas AI — home"
          className="rounded-md focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>

      <nav aria-label="Sidebar primary" className="flex-1 overflow-y-auto p-4">
        <ul className="flex flex-col gap-1">
          {mainNavLinks.map((link) => {
            const Icon = link.icon;
            const active = isActiveLink(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sprint 4
          </p>
          <p className="mt-1 text-sm font-semibold">Action Board live</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rule firings, AI decisions, and Kanban tracking.
          </p>
        </div>
      </div>
    </aside>
  );
}
