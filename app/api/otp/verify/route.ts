import { NextResponse } from "next/server";
import { setDoctorTokenCookie } from "@/lib/auth/doctor";
import {
  emailOtpMatches,
  getEmailOtpRecord,
  invalidateEmailOtp,
} from "@/lib/email-otp-store";
import { apiError, parseJsonBody } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createVerificationSessionToken,
  VERIFICATION_SESSION_MS,
} from "@/lib/otp";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
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
      const clientIp = getClientIp(request);
      const ipLimit = checkRateLimit(`otp-verify:ip:${clientIp}`, {
        windowMs: 60_000,
        max: 10,
      });
      if (!ipLimit.allowed) {
        return rateLimitResponse(ipLimit.retryAfterSeconds);
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

      const emailLimit = checkRateLimit(`otp-verify:email:${emailNormalized}`, {
        windowMs: 15 * 60_000,
        max: 5,
      });
      if (!emailLimit.allowed) {
        return rateLimitResponse(emailLimit.retryAfterSeconds);
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
          const existingClinicId = await findClinicIdByEmail(emailNormalized);
          const response = NextResponse.json({
            success: true,
            verified: true,
            session_token: record.session_token,
            clinic_id: existingClinicId,
            logged_in: Boolean(existingClinicId),
            message: existingClinicId
              ? "Welcome back — you are signed in."
              : "Email already verified.",
          });

          if (existingClinicId) {
            setDoctorTokenCookie(response, existingClinicId);
          }

          return response;
        }
      }

      if (new Date(record.expires_at) < new Date()) {
        return apiError("OTP expired. Please request a new OTP.", 400);
      }

      if (!emailOtpMatches(record, emailNormalized, otp)) {
        const failLimit = checkRateLimit(
          `otp-verify-fail:email:${emailNormalized}`,
          { windowMs: 15 * 60_000, max: 5 },
        );
        if (!failLimit.allowed) {
          return rateLimitResponse(failLimit.retryAfterSeconds);
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

      const existingClinicId = await findClinicIdByEmail(emailNormalized);
      const response = NextResponse.json({
        success: true,
        verified: true,
        session_token: sessionToken,
        clinic_id: existingClinicId,
        logged_in: Boolean(existingClinicId),
        message: existingClinicId
          ? "Welcome back — you are signed in."
          : "Email verified successfully.",
      });

      if (existingClinicId) {
        setDoctorTokenCookie(response, existingClinicId);
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
