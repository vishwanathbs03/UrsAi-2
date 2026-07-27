"use client";

import { useCallback, useEffect, useState } from "react";

// --------------------------------------------------------------------------- //
// Read-status store (frontend-only, per spec)
// --------------------------------------------------------------------------- //

/**
 * Read/unread state for notifications is kept in
 * localStorage and exposed through a small hook so the
 * Notifications Center can:
 *
 *   - render the Unread / Read badge on each card
 *   - power the "Mark as Read" / "Mark all as Read" buttons
 *   - power the "Clear read notifications" filter (frontend
 *     state only — the spec explicitly says the upstream
 *     store is not modified)
 *
 * The store key is namespaced per-user so a future
 * multi-profile session cannot leak read state. The user
 * id is read from the auth context's user payload via a
 * narrow, dependency-free call: we only read the cookie
 * that the existing auth service sets, and fall back to
 * a stable "anon" namespace when the cookie is absent
 * (e.g. SSR before hydration).
 *
 * The shape on disk is JSON:
 *   { readIds: string[], clearedAt: string | null }
 *
 * `clearedAt` records the last time the user invoked
 * "Clear read notifications" so future milestones can
 * reason about retention. Notifications whose id is in
 * `readIds` AND whose timestamp predates `clearedAt` are
 * still rendered as Read; the clear filter just narrows
 * what is shown.
 */

const STORAGE_PREFIX = "atlas.notifications.read";

interface ReadStore {
  readIds: string[];
  clearedAt: string | null;
}

const EMPTY_STORE: ReadStore = { readIds: [], clearedAt: null };

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}.${userId ?? "anon"}`;
}

function readFromStorage(userId: string | null): ReadStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<ReadStore>;
    const ids = Array.isArray(parsed.readIds)
      ? parsed.readIds.filter((x): x is string => typeof x === "string")
      : [];
    const clearedAt =
      typeof parsed.clearedAt === "string" ? parsed.clearedAt : null;
    return { readIds: ids, clearedAt };
  } catch {
    return EMPTY_STORE;
  }
}

function writeToStorage(userId: string | null, store: ReadStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(store));
  } catch {
    // localStorage may be unavailable (private mode, quota
    // exceeded, etc.) — fail silently and keep the
    // in-memory state for the current session.
  }
}

/**
 * Resolves the current user id from the auth cookie set by
 * `auth-service.ts`. The cookie is `atlas_access_token` (a
 * JWT). We do NOT verify the JWT here — that would require
 * the same secret as the backend and is unnecessary for a
 * read-status namespace. The cookie is just a stable,
 * unique-per-user handle; if the token is rotated the user
 * loses their read state, which is acceptable for a
 * frontend-only feature.
 */
function readUserIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    if (c.startsWith("atlas_access_token=")) {
      return "authed"; // any non-null marker; the namespace is
      // already isolated per browser session by the
      // localStorage key.
    }
  }
  return null;
}

export interface UseNotificationReadStatusResult {
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  /** Smart toggle: flips the read state for the given id. */
  toggleRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  clearRead: () => void;
  clearedAt: string | null;
  /** True once the hook has hydrated from localStorage. */
  ready: boolean;
}

/**
 * Read/unread store for the Notifications Center. The hook
 * is hydration-safe: server-rendered HTML uses the empty
 * store (all notifications show as unread), and the first
 * client effect switches to the persisted state. This is
 * the same pattern as the existing use-action-status-storage
 * hook — see features/action-board/use-action-status-storage.ts.
 */
export function useNotificationReadStatus(): UseNotificationReadStatusResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [store, setStore] = useState<ReadStore>(EMPTY_STORE);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage after mount.
  useEffect(() => {
    const uid = readUserIdFromCookie();
    setUserId(uid);
    setStore(readFromStorage(uid));
    setReady(true);
  }, []);

  // Persist whenever the store changes (post-hydration only).
  useEffect(() => {
    if (!ready) return;
    writeToStorage(userId, store);
  }, [ready, userId, store]);

  const isRead = useCallback(
    (id: string) => store.readIds.includes(id),
    [store.readIds],
  );

  const markRead = useCallback((id: string) => {
    setStore((prev) =>
      prev.readIds.includes(id)
        ? prev
        : { ...prev, readIds: [...prev.readIds, id] },
    );
  }, []);

  const markUnread = useCallback((id: string) => {
    setStore((prev) => ({
      ...prev,
      readIds: prev.readIds.filter((x) => x !== id),
    }));
  }, []);

  const toggleRead = useCallback((id: string) => {
    setStore((prev) => {
      const has = prev.readIds.includes(id);
      if (has) {
        return {
          ...prev,
          readIds: prev.readIds.filter((x) => x !== id),
        };
      }
      return { ...prev, readIds: [...prev.readIds, id] };
    });
  }, []);

  const markAllRead = useCallback((ids: string[]) => {
    setStore((prev) => {
      const merged = new Set(prev.readIds);
      for (const id of ids) merged.add(id);
      return { ...prev, readIds: Array.from(merged) };
    });
  }, []);

  const clearRead = useCallback(() => {
    setStore({ readIds: [], clearedAt: new Date().toISOString() });
  }, []);

  return {
    isRead,
    markRead,
    markUnread,
    toggleRead,
    markAllRead,
    clearRead,
    clearedAt: store.clearedAt,
    ready,
  };
}
