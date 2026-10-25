import type { NextConfig } from "next";

/**
 * Security headers — the Content-Security-Policy is generated per-request
 * by src/proxy.ts (nonce-based; Next.js 16 renamed middleware to proxy) and is
 * NOT set here. The remaining headers are static and safe to set at config
 * level.
 */
const staticSecurityHeaders = [
  // Prevent MIME sniffing away from the declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak full URLs to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Redundant with frame-ancestors in the CSP, kept for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Disable hardware APIs the site never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Only meaningful over HTTPS; ignored on plain HTTP, so safe in dev.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors must fail the build. `ignoreBuildErrors: true` ships broken
  // code silently — exactly how auth bugs reach production.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Catch double-render / stale-state bugs during development.
  reactStrictMode: true,
  // Remove the X-Powered-By: Next.js header.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders,
      },
      {
        // Never let a proxy or browser cache admin responses.
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
