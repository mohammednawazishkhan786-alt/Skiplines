import { upsertEmailOtp } from "@/lib/email-otp-store";
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response";
import { enforceRateLimit, ipKey } from "@/lib/api-rate-limit";
import { getResendApiKey, isDevOtpBypassEnabled } from "@/lib/env";
import {
  deliverOtp,
  generateOtp,
  OTP_TTL_MS,
} from "@/lib/otp";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

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

      const ipLimited = await enforceRateLimit(
        request,
        ipKey(request, "otp-send"),
        { windowMs: 60_000, max: 5, failClosed: true },
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

      if (!isValidEmail(emailNormalized)) {
        return apiError("Please enter a valid email address.", 400);
      }

      const emailLimited = await enforceRateLimit(
        request,
        `otp-send:email:${emailNormalized}`,
        { windowMs: 15 * 60_000, max: 3, failClosed: true },
      );
      if (emailLimited) {
        return emailLimited;
      }

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
