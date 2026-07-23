"use client";

import { AuthProvider } from "@/hooks/use-auth";
import type { ReactNode } from "react";

/**
 * Client-only wrapper around the AuthProvider so the root layout can
 * stay a server component.
 */
export function AuthProviderClient({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
