import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).host : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

/**
 * Practical CSP for Skiplines:
 * - Next.js / Vercel / Sentry
 * - Supabase (if any residual client use)
 * - Cashfree checkout scripts & frames
 * - Google fonts (Geist via next/font is self-hosted; keep fonts.gstatic for safety)
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.cashfree.com https://*.cashfree.com:*",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com https://*.cashfree.com https://browser.sentry-cdn.com https://*.sentry.io https://www.googletagmanager.com https://connect.facebook.net`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.supabase.co wss://*.supabase.co https://api.cashfree.com https://sandbox.cashfree.com https://*.cashfree.com https://*.sentry.io https://*.ingest.sentry.io https://vercel.live https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://*.facebook.com`,
  `frame-src 'self' https://sdk.cashfree.com https://*.cashfree.com https://vercel.live`,
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
