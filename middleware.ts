import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildCanonicalRedirectUrl,
  isVercelCronJobPath,
  normalizeCronPathname,
  shouldRedirectToCanonicalHost,
} from "@/lib/canonical-host";

/**
 * Browser navigations to Cashfree API routes must never render raw JSON.
 * Redirect those GET requests to the dashboard React page instead.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const method = request.method.toUpperCase();
  const pathname = request.nextUrl.pathname;
  const cronPath = normalizeCronPathname(pathname);

  // Vercel Cron may request cron paths with a trailing slash; rewrite internally
  // instead of following Next.js's 308 trailing-slash redirect.
  if (cronPath !== pathname && isVercelCronJobPath(cronPath)) {
    const url = request.nextUrl.clone();
    url.pathname = cronPath;
    return NextResponse.rewrite(url);
  }

  if (
    shouldRedirectToCanonicalHost(host, cronPath) &&
    (method === "GET" || method === "HEAD")
  ) {
    const destination = buildCanonicalRedirectUrl(
      cronPath,
      request.nextUrl.search,
    );
    return NextResponse.redirect(destination, 308);
  }

  if (
    method === "GET" &&
    pathname.startsWith("/api/cashfree/") &&
    !pathname.includes("webhook")
  ) {
    const clinic =
      request.nextUrl.searchParams.get("clinic") ??
      request.nextUrl.searchParams.get("clinic_id");
    const destination = buildCanonicalRedirectUrl(
      clinic ? `/dashboard?clinic=${clinic}` : "/dashboard",
      "",
    );
    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
