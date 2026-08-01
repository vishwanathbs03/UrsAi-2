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

  // Save last visited page in localStorage for smooth navigation memory
  if (typeof window !== "undefined" && pathname !== "/" && !pathname.startsWith("/auth")) {
    try {
      localStorage.setItem("urs_last_visited_page", pathname);
    } catch {
      // Ignore quota errors
    }
  }

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-30 lg:border-r lg:border-border/80 lg:bg-background/95 lg:backdrop-blur-md transition-all duration-200",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-border/80 px-6">
        <Link
          href="/"
          aria-label="UrsBiz — home"
          className="rounded-md focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>

      <nav aria-label="Sidebar primary" className="flex-1 overflow-y-auto p-3">
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
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-xs border-l-2 border-primary pl-2.5"
                      : "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/80 p-4">
        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 text-card-foreground shadow-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Navigation Active
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground truncate">
            {pathname}
          </p>
        </div>
      </div>
    </aside>
  );
}
