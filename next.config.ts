import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the IM preview proxy origins to load /_next/* dev resources.
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
