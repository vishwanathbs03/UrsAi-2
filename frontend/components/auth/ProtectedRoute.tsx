"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingScreen } from "@/components/common/LoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Redirects unauthenticated users to /login, preserving the current
 * path as `?next=` so they land back here after signing in.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(pathname ?? "/");
      router.replace(`/login?next=${next}`);
    }
  }, [status, pathname, router]);

  // Sprint 9 Part 2 — only ``loading`` shows the splash. Once the
  // auth context resolves to ``unauthenticated`` we render nothing
  // because the useEffect above is about to redirect; rendering a
  // loading screen during the brief gap was a waste of time and
  // made the timeout case look like a hang.
  if (status === "loading") {
    return <LoadingScreen label="Checking your session…" />;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
