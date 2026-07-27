/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sprint 8 Part 1 — production infrastructure.
  //
  // `standalone` bundles only the runtime files needed by `next start`
  // (a self-contained server folder). The production Dockerfile copies
  // this folder into the runtime image so the container ships ~150 MB
  // instead of the full node_modules tree (~700 MB).
  output: "standalone",
};

export default nextConfig;
