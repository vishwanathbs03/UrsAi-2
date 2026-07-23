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

  if (status === "loading" || status === "unauthenticated") {
    return <LoadingScreen label="Checking your session…" />;
  }

  return <>{children}</>;
}
