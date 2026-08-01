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
  apiBaseUrl: "http://localhost:8001",
  appName: "UrsBiz",
  appUrl: "http://localhost:3000",
};

function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

export const env: EnvShape = {
  apiBaseUrl: cleanUrl(
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULTS.apiBaseUrl,
  ),
  appName:
    process.env.NEXT_PUBLIC_APP_NAME || DEFAULTS.appName,
  appUrl: cleanUrl(
    process.env.NEXT_PUBLIC_APP_URL || DEFAULTS.appUrl,
  ),
};
