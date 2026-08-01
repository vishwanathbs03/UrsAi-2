/**
 * Typed fetch-based API client.
 *
 * Used by all services to talk to the Atlas AI backend. Throws an
 * `ApiError` on non-2xx responses so callers can handle failures in a
 * single place. This is a placeholder; per-endpoint helpers are added
 * in later milestones.
 */

import { env } from "@/lib/env";

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = env.apiBaseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!query) {
    return `${base}${cleanPath}`;
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${base}${cleanPath}?${qs}` : `${base}${cleanPath}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, query, headers, ...rest } = options;
  const url = buildUrl(path, query);

  // TEMP: full request/response trace for the wizard
  if (path.startsWith("/api/v1/business")) {
    // eslint-disable-next-line no-console
    console.log("[BUSREQ-REQ]", rest.method ?? "?", url, {
      body,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });
  }

  const response = await fetch(url, {
    ...rest,
    // The backend issues the JWT as an HTTP-only cookie. Browsers
    // refuse to attach it on cross-origin requests unless the
    // request opts in via `credentials: "include"`. Without this,
    // POST /business, GET /auth/me and every other protected
    // endpoint return 401 after login even though the cookie is
    // present in the browser jar.
    credentials: rest.credentials ?? "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const parsed = await parseBody(response);

  if (path.startsWith("/api/v1/business")) {
    // eslint-disable-next-line no-console
    console.log("[BUSREQ-RES]", rest.method ?? "?", url, response.status, parsed);
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : null) ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, parsed);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
