"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persisted Kanban column status for an action card.
 * Only three values — any other value coming from a
 * legacy/corrupt localStorage entry is normalised back to
 * the default ("todo") so the UI never renders an unknown
 * column.
 */
export type ActionStatus = "todo" | "in_progress" | "completed";

export const ACTION_STATUS_VALUES: ActionStatus[] = [
  "todo",
  "in_progress",
  "completed",
];

const STATUS_LABELS: Record<ActionStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
};

const STORAGE_KEY = "atlas-ai.action-board.statuses.v1";

function isActionStatus(value: unknown): value is ActionStatus {
  return (
    typeof value === "string" &&
    (ACTION_STATUS_VALUES as string[]).includes(value)
  );
}

/**
 * Read the persisted status map. Returns an empty object if
 * localStorage is unavailable, the entry is missing, or the
 * JSON is corrupt. We never throw out of a reader — the UI
 * degrades gracefully to "all in To Do".
 */
function readAll(): Record<string, ActionStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, ActionStatus> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isActionStatus(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, ActionStatus>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be full / disabled (private mode). The
    // in-memory state still works; we just won't persist.
  }
}

export interface UseActionStatusStorageResult {
  /** Lookup the status for a single action id. Falls back to "todo". */
  getStatus: (actionId: string) => ActionStatus;
  /** Imperative setter for a single action id. */
  setStatus: (actionId: string, status: ActionStatus) => void;
  /** Imperative bulk setter — used when cards move between columns. */
  setMany: (updates: Record<string, ActionStatus>) => void;
  /** Reset every persisted status back to "todo". */
  clearAll: () => void;
  /** Stable accessor for the full map; useful for derived counts. */
  all: Record<string, ActionStatus>;
}

/**
 * Browser-only status persistence for the Action Board.
 *
 * Design notes:
 *  - One localStorage key (`atlas-ai.action-board.statuses.v1`)
 *    holding `Record<actionId, ActionStatus>`. Versioned so a
 *    future shape change can be migrated without collision.
 *  - All readers are defensive: missing key / corrupt JSON /
 *    non-browser environment all return "no statuses" rather
 *    than throw. The UI is the single source of truth for
 *    what an action is; storage is a cache.
 *  - The hook is `useState` driven so React re-renders when
 *    the map changes, but writes are coalesced — calling
 *    setStatus in a loop triggers exactly one re-render via
 *    a functional updater.
 */
export function useActionStatusStorage(): UseActionStatusStorageResult {
  // Initialise lazily on the client to avoid SSR
  // `localStorage is not defined` traps.
  const [map, setMap] = useState<Record<string, ActionStatus>>(() => {
    if (typeof window === "undefined") return {};
    return readAll();
  });

  // After mount, if we were on the server, re-read the
  // current snapshot. This handles the SSR-with-hydration
  // path: the server renders with no statuses, and the
  // client immediately picks up the persisted ones.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMap(readAll());
  }, []);

  // Cross-tab sync — if the user has two tabs of the
  // board open and drags a card in one, the other updates
  // without a refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      setMap(readAll());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setStatus = useCallback((actionId: string, status: ActionStatus) => {
    setMap((prev) => {
      if (prev[actionId] === status) return prev;
      const next = { ...prev, [actionId]: status };
      writeAll(next);
      return next;
    });
  }, []);

  const setMany = useCallback((updates: Record<string, ActionStatus>) => {
    setMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, status] of Object.entries(updates)) {
        if (next[id] !== status) {
          next[id] = status;
          changed = true;
        }
      }
      if (!changed) return prev;
      writeAll(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setMap(() => {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore — same as writeAll
      }
      return {};
    });
  }, []);

  const getStatus = useCallback(
    (actionId: string): ActionStatus => map[actionId] ?? "todo",
    [map],
  );

  return { getStatus, setStatus, setMany, clearAll, all: map };
}

export { STATUS_LABELS };
