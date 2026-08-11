import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "skiplines.in" }],
        destination: "https://www.skiplines.in/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "skiplines-app.vercel.app" }],
        destination: "https://www.skiplines.in/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "skiplines-app-nawazish-khans-projects.vercel.app" },
        ],
        destination: "https://www.skiplines.in/:path*",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
