"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-client";

/**
 * Client-side provider that wires the shared QueryClient
 * into the React tree. A single instance is created per
 * session (held in component state so it survives the
 * `useState` re-render cycle but is not recreated on every
 * parent re-render).
 *
 * The provider sits at the root of the authenticated app
 * shell (see `app/(app)/layout.tsx`) so every dashboard
 * and action-board view shares one cache.
 */
import { ToastProvider } from "@/components/ui/toast";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
