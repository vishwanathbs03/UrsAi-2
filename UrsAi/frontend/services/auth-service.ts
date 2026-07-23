/**
 * Auth service — talks to the Atlas AI backend auth endpoints.
 *
 * Browser clients are authenticated via the HTTP-only `atlas_access_token`
 * cookie set by the backend. We still pass `credentials: "include"` so
 * the cookie is sent on every cross-origin request.
 */

import { env } from "@/lib/env";
import type { AuthSuccess, User } from "@/types/auth";

const BASE = env.apiBaseUrl.replace(/\/+$/, "");

class AuthServiceError extends Error {
  public readonly status: number;
  public readonly fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type ValidationDetail = { loc?: string[]; msg?: string; type?: string };

function extractFieldErrors(detail: unknown): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  if (typeof detail === "string") {
    return { message: detail, fieldErrors: {} };
  }
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const entry of detail as ValidationDetail[]) {
      const loc = entry.loc ?? [];
      // loc is e.g. ["body", "password"] — drop the leading "body".
      const field = loc.length > 1 ? String(loc[loc.length - 1]) : "form";
      if (!fieldErrors[field] && entry.msg) {
        fieldErrors[field] = entry.msg;
      }
    }
    const first = (detail as ValidationDetail[])[0];
    return {
      message: first?.msg ?? "Please check the form for errors.",
      fieldErrors,
    };
  }
  return { message: "Request failed.", fieldErrors: {} };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  // 204 — no body
  if (response.status === 204) {
    return undefined as T;
  }

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const detail = (parsed as { detail?: unknown } | null)?.detail;
    const { message, fieldErrors } = extractFieldErrors(detail);
    throw new AuthServiceError(message, response.status, fieldErrors);
  }

  return parsed as T;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthSuccess> {
    return request<AuthSuccess>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginPayload): Promise<AuthSuccess> {
    return request<AuthSuccess>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logout(): Promise<void> {
    await request<void>("/api/v1/auth/logout", { method: "POST" });
  },

  async me(): Promise<User> {
    return request<User>("/api/v1/auth/me", { method: "GET" });
  },
};

export { AuthServiceError };
