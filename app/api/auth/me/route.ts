import { NextResponse } from "next/server";
import {
  getDoctorTokenFromRequest,
  verifyDoctorToken,
} from "@/lib/auth/doctor";
import { withSentryApiRoute } from "@/lib/sentry-api";

export const GET = withSentryApiRoute(
  "GET",
  "/api/auth/me",
  async function GET(request: Request) {
    const token = getDoctorTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifyDoctorToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      clinic_id: payload.clinicId,
      doctor_id: payload.clinicId,
    });
  },
);
