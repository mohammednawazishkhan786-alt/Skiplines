import { NextResponse } from "next/server";
import { setDoctorTokenCookie } from "@/lib/auth/doctor";
import {
  emailOtpMatches,
  getEmailOtpRecord,
  invalidateEmailOtp,
} from "@/lib/email-otp-store";
import { apiError, parseJsonBody } from "@/lib/api-response";
import { enforceRateLimit, ipKey } from "@/lib/api-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createVerificationSessionToken,
  VERIFICATION_SESSION_MS,
} from "@/lib/otp";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

async function findClinicIdByEmail(emailNormalized: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("id")
    .ilike("email", emailNormalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Could not verify clinic account.");
  }

  return (data?.id as string | undefined) ?? null;
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/otp/verify",
  async function POST(request: Request) {
    try {
      const ipLimited = await enforceRateLimit(
        request,
        ipKey(request, "otp-verify"),
        { windowMs: 60_000, max: 10, failClosed: true },
      );
      if (ipLimited) {
        return ipLimited;
      }

      const parsedBody = await parseJsonBody(request);
      if (!parsedBody.ok) {
        return apiError("Invalid request body.", 400);
      }

      const emailNormalized = normalizeEmail(
        String(parsedBody.body.email ?? ""),
      );
      const otp = String(parsedBody.body.otp ?? "").trim();

      if (!isValidEmail(emailNormalized) || otp.length !== 6) {
        return apiError("Enter your email address and 6-digit OTP.", 400);
      }

      const emailLimited = await enforceRateLimit(
        request,
        `otp-verify:email:${emailNormalized}`,
        { windowMs: 15 * 60_000, max: 5, failClosed: true },
      );
      if (emailLimited) {
        return emailLimited;
      }

      let record;
      try {
        record = await getEmailOtpRecord(emailNormalized);
      } catch (lookupError) {
        captureApiError(lookupError);
        return apiError("Could not verify OTP. Please try again.", 500);
      }

      if (!record) {
        return apiError("No OTP found. Please request a new OTP.", 400);
      }

      if (record.verified_at && record.session_token) {
        const verifiedAt = new Date(record.verified_at).getTime();
        if (Date.now() - verifiedAt < VERIFICATION_SESSION_MS) {
          const existingDoctorId = await findClinicIdByEmail(emailNormalized);
          const response = NextResponse.json({
            success: true,
            verified: true,
            session_token: record.session_token,
            clinic_id: existingDoctorId,
            doctor_id: existingDoctorId,
            logged_in: Boolean(existingDoctorId),
            message: existingDoctorId
              ? "Welcome back — you are signed in."
              : "Email already verified.",
          });

          if (existingDoctorId) {
            setDoctorTokenCookie(response, existingDoctorId);
          }

          return response;
        }
      }

      if (new Date(record.expires_at) < new Date()) {
        return apiError("OTP expired. Please request a new OTP.", 400);
      }

      if (!emailOtpMatches(record, emailNormalized, otp)) {
        const failLimited = await enforceRateLimit(
          request,
          `otp-verify-fail:email:${emailNormalized}`,
          { windowMs: 15 * 60_000, max: 5, failClosed: true },
        );
        if (failLimited) {
          return failLimited;
        }

        return apiError("Invalid OTP. Please try again.", 400);
      }

      const sessionToken = createVerificationSessionToken();

      try {
        await invalidateEmailOtp(record.id, sessionToken);
      } catch (invalidateError) {
        captureApiError(invalidateError);
        return apiError("Could not complete OTP verification. Please try again.", 500);
      }

      const existingDoctorId = await findClinicIdByEmail(emailNormalized);
      const response = NextResponse.json({
        success: true,
        verified: true,
        session_token: sessionToken,
        clinic_id: existingDoctorId,
        doctor_id: existingDoctorId,
        logged_in: Boolean(existingDoctorId),
        message: existingDoctorId
          ? "Welcome back — you are signed in."
          : "Email verified successfully.",
      });

      if (existingDoctorId) {
        setDoctorTokenCookie(response, existingDoctorId);
      }

      return response;
    } catch (error) {
      captureApiError(error);
      return apiError(
        error instanceof Error
          ? error.message
          : "OTP verification failed. Please try again.",
        500,
      );
    }
  },
);
