import { upsertEmailOtp } from "@/lib/email-otp-store";
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response";
import { getResendApiKey } from "@/lib/env";
import {
  deliverOtp,
  generateOtp,
  OTP_TTL_MS,
} from "@/lib/otp";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { isDevOtpBypassEnabled } from "@/lib/resend-otp";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

async function findExistingClinicByEmail(emailNormalized: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("id")
    .ilike("email", emailNormalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Could not verify email registration status.");
  }

  return data;
}

function ensureEmailDeliveryConfigured() {
  if (getResendApiKey() || isDevOtpBypassEnabled()) {
    return null;
  }

  return apiError(
    "Email service is not configured. Please try again later.",
    500,
  );
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/otp/send",
  async function POST(request: Request) {
    try {
      const deliveryCheck = ensureEmailDeliveryConfigured();
      if (deliveryCheck) {
        return deliveryCheck;
      }

      const clientIp = getClientIp(request);
      const ipLimit = checkRateLimit(`otp-send:ip:${clientIp}`, {
        windowMs: 60_000,
        max: 5,
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

      if (!isValidEmail(emailNormalized)) {
        return apiError("Please enter a valid email address.", 400);
      }

      const emailLimit = checkRateLimit(`otp-send:email:${emailNormalized}`, {
        windowMs: 15 * 60_000,
        max: 3,
      });
      if (!emailLimit.allowed) {
        return rateLimitResponse(emailLimit.retryAfterSeconds);
      }

      const existingClinic = await findExistingClinicByEmail(emailNormalized);
      const isLogin = Boolean(existingClinic);
      const otp = generateOtp();

      try {
        await upsertEmailOtp(emailNormalized, otp);
      } catch (storeError) {
        captureApiError(storeError);
        return apiError(
          storeError instanceof Error
            ? storeError.message
            : "Could not store OTP. Please try again.",
          500,
        );
      }

      let delivery;
      try {
        delivery = await deliverOtp(emailNormalized, otp);
      } catch (resendError) {
        console.error("Resend OTP Delivery Error:", resendError);
        captureApiError(resendError);
        return apiError(
          resendError instanceof Error
            ? resendError.message
            : "Failed to send OTP. Please check server logs or try again.",
          500,
        );
      }

      return apiSuccess({
        message: `Email OTP sent to ${emailNormalized}. Valid for 5 minutes.`,
        channel: delivery.channel,
        expires_in_seconds: OTP_TTL_MS / 1000,
        dev_otp: delivery.devOtp,
        login: isLogin,
      });
    } catch (error) {
      captureApiError(error);
      return apiError(
        error instanceof Error
          ? error.message
          : "Failed to send OTP. Please check server logs or try again.",
        500,
      );
    }
  },
);
