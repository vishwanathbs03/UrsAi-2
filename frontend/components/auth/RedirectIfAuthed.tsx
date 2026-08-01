"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingScreen } from "@/components/common/LoadingScreen";

interface RedirectIfAuthedProps {
  children: React.ReactNode;
  /** Path to redirect to if the user is already signed in. */
  to?: string;
}

/**
 * Sends already-authenticated users away from auth pages.
 */
export function RedirectIfAuthed({ children, to = "/dashboard" }: RedirectIfAuthedProps) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(to);
    }
  }, [status, router, to]);

  if (status === "loading" || status === "authenticated") {
    return <LoadingScreen label="Loading…" />;
  }

  return <>{children}</>;
}
