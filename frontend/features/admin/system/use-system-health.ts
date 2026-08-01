"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/api-client";

/**
 * Telemetry payload returned by ``GET /health`` after Sprint 8 Part 2.
 *
 * Mirrors the schema produced by `app.monitoring.health._build_full_health`
 * with one extra ``refreshing`` flag (client-side only) that the
 * view uses to show the refresh spinner.
 */
export interface SystemHealth {
  status: "ok" | "degraded" | "down";
  api: { ok: boolean; detail: string };
  database: { ok: boolean; detail: string };
  ai: { ok: boolean; detail: string };
  knowledge: { ok: boolean; detail: string };
  /** Process uptime in seconds (float). */
  uptime: number;
  /** Build / version string. */
  version: string;
  /** Current environment (production / staging / development). */
  env: string;
  /** Total HTTP requests served by this worker since process start. */
  request_count: number;
  /** In-flight requests right now. */
  active_requests: number;
  /** Process-wide average request duration in milliseconds. */
  avg_latency_ms: number;
  /** 5xx share, 0.0 - 1.0. */
  error_rate: number;
  /** Server-side ISO timestamp. */
  timestamp: string;
}

export type SystemHealthState =
  | { status: "loading" }
  | { status: "ready"; data: SystemHealth }
  | { status: "error"; detail: string };

export interface UseSystemHealthResult {
  state: SystemHealthState;
  refresh: () => void;
  isFetching: boolean;
  lastFetchedAt: number | null;
}

const REFRESH_INTERVAL_MS = 15_000;

/**
 * Lightweight hook around ``GET /health``.
 *
 * The /admin/system page is read-only — it polls the endpoint
 * every 15s so an operator who keeps the tab open sees the
 * counters tick without manual refresh. The hook does NOT use
 * TanStack Query because the endpoint is intentionally trivial
 * (single GET, no caching, no dedup) and pulling in a query
 * client here would couple observability to the rest of the
 * app's data layer.
 */
export function useSystemHealth(): UseSystemHealthResult {
  const [state, setState] = useState<SystemHealthState>({
    status: "loading",
  });
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    setIsFetching(true);
    try {
      const data = await apiClient.get<SystemHealth>("/health");
      if (cancelledRef.current) return;
      setState({ status: "ready", data });
      setLastFetchedAt(Date.now());
    } catch (err) {
      if (cancelledRef.current) return;
      const detail =
        err instanceof Error ? err.message : "Could not load system health.";
      setState({ status: "error", detail });
    } finally {
      if (!cancelledRef.current) setIsFetching(false);
    }
  }, []);

  // Initial load + interval poll. The interval is cleared on unmount
  // so a hot-reload does not leak timers.
  useEffect(() => {
    cancelledRef.current = false;
    void fetchOnce();
    const id = window.setInterval(() => {
      void fetchOnce();
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(id);
    };
  }, [fetchOnce]);

  const refresh = useCallback(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { state, refresh, isFetching, lastFetchedAt };
}
