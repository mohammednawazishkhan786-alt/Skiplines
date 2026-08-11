import { createHash, randomInt } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;

export function hashOtp(emailNormalized: string, otp: string) {
  return createHash("sha256")
    .update(`${emailNormalized}:${otp}`)
    .digest("hex");
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

export function emailOtpMatches(
  record: { otp_hash: string },
  emailNormalized: string,
  otp: string,
) {
  const otpCode = otp.trim();
  return record.otp_hash === hashOtp(emailNormalized, otpCode);
}
