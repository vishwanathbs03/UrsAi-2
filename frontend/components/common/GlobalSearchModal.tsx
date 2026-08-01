"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Building2, FileText, BarChart3, Compass, Bot, Lightbulb, Bell, X } from "lucide-react";

interface SearchItem {
  id: string;
  title: string;
  category: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const SEARCH_INDEX: SearchItem[] = [
  { id: "dash", title: "Executive Dashboard", category: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "biz", title: "Business Profile & DNA", category: "Business Profile", href: "/business", icon: Building2 },
  { id: "analytics", title: "Business Analytics Overview", category: "Analytics", href: "/analytics", icon: BarChart3 },
  { id: "predictive", title: "Predictive Growth Forecasts", category: "Analytics", href: "/predictive-analytics", icon: BarChart3 },
  { id: "insights", title: "AI Business Insights Feed", category: "Insights", href: "/insights", icon: Lightbulb },
  { id: "advisor", title: "Autonomous Business Advisor", category: "Advisor", href: "/advisor", icon: Compass },
  { id: "assistant", title: "AI Assistant Chat Thread", category: "AI conversations", href: "/assistant", icon: Bot },
  { id: "reports", title: "Executive PDF/CSV Reports", category: "Reports", href: "/reports", icon: FileText },
  { id: "notifs", title: "Notification Center", category: "Notifications", href: "/notifications", icon: Bell },
];

export function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const filtered = SEARCH_INDEX.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-background/80 backdrop-blur-sm p-4 animate-page-fade"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/80 bg-secondary/30">
          <Search className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Dashboard, Business, Analytics, Advisor, Reports... (Ctrl+K)"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No matching pages found for &quot;{query}&quot;.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg text-left hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                        {item.category}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
