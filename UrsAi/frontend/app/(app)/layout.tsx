import { AppLayout } from "@/components/layout/AppLayout";
import { QueryProvider } from "@/components/common/QueryProvider";

/**
 * Authenticated app layout: navbar + sidebar + content. Used by all
 * post-login routes. Also hosts the shared TanStack Query client so
 * the dashboard and action-board caches are unified.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppLayout withSidebar>{children}</AppLayout>
    </QueryProvider>
  );
}
