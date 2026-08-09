import { createHash, randomBytes, randomInt } from "node:crypto";
import { sendWhatsAppOtp, isDevOtpBypassEnabled } from "@/lib/whatsapp-otp";
import { normalizePhone } from "@/lib/phone";

export const DUPLICATE_PHONE_MESSAGE =
  "This mobile number has already used a 7-day free trial.";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const VERIFICATION_SESSION_MS = 5 * 60 * 1000;

export function hashOtp(phoneNormalized: string, otp: string) {
  return createHash("sha256")
    .update(`${phoneNormalized}:${otp}`)
    .digest("hex");
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function createVerificationSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function deliverOtp(phone: string, otp: string) {
  const phoneNormalized = normalizePhone(phone);
  const result = await sendWhatsAppOtp(phoneNormalized, otp);

  if (result.channel === "dev") {
    return { channel: "dev" as const, devOtp: otp };
  }

  return { channel: "whatsapp" as const, devOtp: undefined };
}

export { isDevOtpBypassEnabled };
