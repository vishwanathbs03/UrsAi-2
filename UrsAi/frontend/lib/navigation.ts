import { Home, LayoutDashboard, Building2, KanbanSquare, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from main navigation (still routable). */
  hidden?: boolean;
}

/**
 * Single source of truth for app navigation. Both the top navbar and
 * the sidebar read from this list so they can never disagree.
 */
export const mainNavLinks: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/action-board", label: "Action Board", icon: KanbanSquare },
  { href: "/business", label: "Business", icon: Building2 },
];

export const marketingLinks: NavLink[] = [
  { href: "/", label: "Product", icon: Sparkles, hidden: true },
];

export function isActiveLink(currentPath: string, linkHref: string): boolean {
  if (linkHref === "/") {
    return currentPath === "/";
  }
  return currentPath === linkHref || currentPath.startsWith(`${linkHref}/`);
}
