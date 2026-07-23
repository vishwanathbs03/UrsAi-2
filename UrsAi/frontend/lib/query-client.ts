"use client";

import { QueryClient } from "@tanstack/react-query";

/**
 * Single shared QueryClient for the app.
 *
 * Defaults chosen for the dashboard's traffic pattern:
 *  - `staleTime: 30s` so flipping between the dashboard and
 *    the action board and back does not re-fire the five
 *    intelligence / scores / DNA / rules / decision
 *    endpoints while the user is just navigating.
 *  - `gcTime: 5m` so a tab that's been backgrounded for a
 *    couple of minutes still has the cached payloads and
 *    renders instantly.
 *  - `retry: 1` because the spec calls for a friendly
 *    error state with a retry button — re-trying 3 times in
 *    a row before showing the error state is the wrong UX.
 *  - `refetchOnWindowFocus: false` because the dashboard
 *    is not a live-monitoring view; the user has an
 *    explicit "Refresh" button.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}
