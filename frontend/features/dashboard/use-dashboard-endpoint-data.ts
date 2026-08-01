"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardService, DashboardEndpointResponse } from "@/services/dashboard-service";

export type DashboardEndpointState =
  | { status: "loading" }
  | { status: "no-business"; detail?: string }
  | { status: "error"; detail: string }
  | { status: "ready"; data: DashboardEndpointResponse };

export function useDashboardEndpointData() {
  const [state, setState] = useState<DashboardEndpointState>({ status: "loading" });
  const [isFetching, setIsFetching] = useState(false);

  const load = useCallback(async () => {
    setIsFetching(true);
    try {
      const data = await dashboardService.getDashboard();
      if (!data.business) {
        setState({ status: "no-business", detail: "No business profile found." });
      } else {
        setState({ status: "ready", data });
      }
    } catch (err: any) {
      if (err?.status === 404) {
        setState({ status: "no-business", detail: err?.message || "No business profile found." });
      } else {
        setState({
          status: "error",
          detail: err?.message || "Failed to load dashboard data.",
        });
      }
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, refresh: load, isFetching };
}
