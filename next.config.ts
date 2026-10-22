import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is almost entirely authenticated, per-request data, so Cache Components
  // would force a Suspense boundary around nearly every page. Keep it off for the MVP
  // and cache selectively later (see docs/ARCHITECTURE.md).
  cacheComponents: false,
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "pg"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
