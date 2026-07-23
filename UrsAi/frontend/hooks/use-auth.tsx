"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authService,
  AuthServiceError,
  type LoginPayload,
  type RegisterPayload,
} from "@/services/auth-service";
import type { User } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider that:
 *   1. On mount, asks the backend who the current user is. This
 *      re-establishes the session from the HTTP-only cookie so a
 *      page refresh keeps the user signed in.
 *   2. Exposes login / register / logout helpers.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof AuthServiceError && error.status === 401) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      // Network error — keep prior state but mark as unauthenticated
      // so the UI can prompt the user. A real implementation would
      // differentiate.
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await authService.login(payload);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await authService.register(payload);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, refresh }),
    [status, user, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}
