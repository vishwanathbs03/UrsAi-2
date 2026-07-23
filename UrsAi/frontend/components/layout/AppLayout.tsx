import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  /** When true, the desktop sidebar is rendered alongside the navbar. */
  withSidebar?: boolean;
  className?: string;
}

/**
 * Top-level layout shell shared by every route.
 *
 *  - Sticky Navbar at the top
 *  - Optional desktop Sidebar on the left (lg+)
 *  - Centered main content area
 *
 * Mobile/tablet users see the Navbar + MobileDrawer combination only.
 */
export function AppLayout({ children, withSidebar = true, className }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1">
        {withSidebar && <Sidebar />}
        <main
          id="main-content"
          className={cn(
            "flex-1",
            withSidebar && "lg:pl-64",
            className,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
