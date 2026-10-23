import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Note on Next.js: inline bootstrap scripts and styled-jsx require
 * 'unsafe-inline' for scripts and styles unless a nonce-based CSP is wired
 * through middleware. This policy is therefore not maximally strict, but it
 * still blocks the classes of attack that matter here: no external script
 * origins, no framing, no object embeds, and no base-uri hijacking.
 *
 * 'unsafe-eval' is only added in development, where React Refresh needs it.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // Analytics beacon plus any future same-origin API access.
  `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
  // WhatsApp / telephone contact links navigate away, they are not frameable.
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Prevent MIME sniffing away from the declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak full URLs (which may contain slugs) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Redundant with frame-ancestors, kept for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Disable hardware APIs the site never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Only meaningful over HTTPS; ignored on plain HTTP, so it is safe in dev.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors must fail the build. `ignoreBuildErrors: true` shipped broken
  // code silently, which is exactly how auth bugs reach production.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Catch double-render / stale-state bugs during development.
  reactStrictMode: true,
  // Needed for correct client IPs and secure-cookie decisions behind the LB.
  // Next.js honours these when present in the environment.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
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
