import { AppLayout } from "@/components/layout/AppLayout";
import { QueryProvider } from "@/components/common/QueryProvider";
import { StartupSplash } from "@/components/common/StartupSplash";

/**
 * Authenticated app layout: navbar + sidebar + content. Used by all
 * post-login routes. Also hosts the shared TanStack Query client so
 * the dashboard and action-board caches are unified.
 *
 * The StartupSplash runs once per session (gated by
 * sessionStorage inside the component) and overlays the app
 * shell while the engine handlers celebrate their initial
 * load. It self-unmounts and the dashboard fades in.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AppLayout withSidebar>{children}</AppLayout>
      <StartupSplash />
    </QueryProvider>
  );
}
