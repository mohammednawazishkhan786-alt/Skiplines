import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildCanonicalRedirectUrl,
  shouldRedirectToCanonicalHost,
} from "@/lib/canonical-host";

/**
 * Browser navigations to Cashfree API routes must never render raw JSON.
 * Redirect those GET requests to the dashboard React page instead.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const method = request.method.toUpperCase();

  if (
    shouldRedirectToCanonicalHost(host) &&
    (method === "GET" || method === "HEAD")
  ) {
    const destination = buildCanonicalRedirectUrl(
      request.nextUrl.pathname,
      request.nextUrl.search,
    );
    return NextResponse.redirect(destination, 308);
  }

  const { pathname } = request.nextUrl;

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
