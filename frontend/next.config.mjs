/** @type {import('next').NextConfig} */

// Backend URL used for the Next.js rewrites proxy and CSP.
// Reads NEXT_PUBLIC_API_URL (or falls back to localhost:8001).
// To use a different port or host, set NEXT_PUBLIC_API_URL in .env.local.
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") ||
  "http://127.0.0.1:8001";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Proxy API requests to backend — configurable via NEXT_PUBLIC_API_URL.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // Build the connect-src value from the env-driven backend URL.
    const backendHosts = new Set([
      BACKEND_URL,
      // Always include both localhost variants so dev machines using
      // 127.0.0.1 or localhost interchangeably never hit a CSP block.
      "http://localhost:8001",
      "http://127.0.0.1:8001",
    ]);
    const connectSrc = `'self' ${[...backendHosts].join(" ")} ws://localhost:* ws://127.0.0.1:*`;

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""}`.trim(),
              `connect-src ${connectSrc}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = "eval-cheap-module-source-map";
    }
    return config;
  },
};

export default nextConfig;