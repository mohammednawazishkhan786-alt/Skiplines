import { randomBytes } from "node:crypto";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import {
  emailOtpMatches,
  generateOtp,
  hashOtp,
  OTP_LENGTH,
  OTP_TTL_MS,
} from "@/lib/otp-crypto";
import { sendEmailOtp } from "@/lib/resend-otp";

export const DUPLICATE_EMAIL_MESSAGE =
  "This email address has already used a 7-day free trial.";

/** @deprecated Use DUPLICATE_EMAIL_MESSAGE */
export const DUPLICATE_PHONE_MESSAGE = DUPLICATE_EMAIL_MESSAGE;

export { OTP_LENGTH, OTP_TTL_MS, hashOtp, generateOtp, emailOtpMatches };

export function createVerificationSessionToken() {
  return randomBytes(32).toString("hex");
}

export const VERIFICATION_SESSION_MS = 5 * 60 * 1000;

export async function deliverOtp(email: string, otp: string) {
  const emailNormalized = normalizeEmail(email);

  if (!isValidEmail(emailNormalized)) {
    throw new Error("Please enter a valid email address.");
  }

  const result = await sendEmailOtp(emailNormalized, otp);

  return {
    channel: result.channel,
    devOtp: result.channel === "dev" ? otp : undefined,
  };
}
