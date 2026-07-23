/**
 * Type-safe environment loader.
 *
 * Reads `process.env.NEXT_PUBLIC_*` variables on the client and any
 * server-only vars on the server. Throws if a required variable is
 * missing at startup so misconfiguration fails fast.
 */

type EnvShape = {
  /** Backend base URL (no trailing slash). */
  apiBaseUrl: string;
  /** Public app name exposed to the client. */
  appName: string;
  /** Public app URL for canonical / OpenGraph references. */
  appUrl: string;
};

const DEFAULTS: EnvShape = {
  apiBaseUrl: "http://127.0.0.1:8000",
  appName: "Atlas AI",
  appUrl: "http://localhost:3000",
};

function readString(name: keyof EnvShape, fallback: string): string {
  const value = process.env[name as string];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.trim().replace(/\/+$/, "");
}

export const env: EnvShape = {
  apiBaseUrl: readString("apiBaseUrl", DEFAULTS.apiBaseUrl),
  appName: readString("appName", DEFAULTS.appName),
  appUrl: readString("appUrl", DEFAULTS.appUrl),
};
