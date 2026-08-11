import { NextResponse } from "next/server";
import { clearDoctorTokenCookie } from "@/lib/auth/doctor";
import { withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/auth/logout",
  async function POST() {
    const response = NextResponse.json({ success: true });
    return clearDoctorTokenCookie(response);
  },
);
