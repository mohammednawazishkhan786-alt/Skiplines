import type { MetadataRoute } from "next";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register", "/privacy", "/terms", "/refund-policy", "/contact", "/data-deletion"],
        disallow: [
          "/login",
          "/dashboard",
          "/clinic/",
          "/live/",
          "/join/",
          "/api/",
        ],
      },
    ],
    sitemap: `${CANONICAL_PRODUCTION_SITE_URL}/sitemap.xml`,
    host: CANONICAL_PRODUCTION_SITE_URL,
  };
}
