import { Resend } from "resend";
import { getResendApiKey } from "@/lib/env";

const RESEND_REQUEST_TIMEOUT_MS = 2_000;
const RESEND_FROM_EMAIL = "Skiplines <otp@skiplines.in>";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Email OTP request timed out. Please try again.")),
        ms,
      );
    }),
  ]);
}

async function sendWithResend(email: string, otp: string) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const resend = new Resend(apiKey);

  const sendPromise = resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: email,
    subject: `${otp} is your Skiplines verification code`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f766e; margin-bottom: 8px;">Skiplines</h2>
        <p style="color: #334155; font-size: 16px;">Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e; margin: 16px 0;">${otp}</p>
        <p style="color: #64748b; font-size: 14px;">Valid for 5 minutes. Do not share this code with anyone.</p>
      </div>
    `,
  });

  const { data, error } = await withTimeout(sendPromise, RESEND_REQUEST_TIMEOUT_MS);

  if (error) {
    console.error("Resend API Response Error:", error);
    throw new Error(error.message ?? "Email OTP delivery failed.");
  }

  if (!data?.id) {
    throw new Error("Email OTP delivery failed.");
  }

  return { channel: "email" as const };
}

export function isDevOtpBypassEnabled() {
  return process.env.OTP_DEV_BYPASS === "true";
}

export async function sendEmailOtp(email: string, otp: string) {
  try {
    return await sendWithResend(email, otp);
  } catch (firstError) {
    console.warn("[OTP] Resend first attempt failed, retrying:", firstError);
    try {
      return await sendWithResend(email, otp);
    } catch (retryError) {
      if (isDevOtpBypassEnabled()) {
        console.log(`[DEV OTP] ${email}: ${otp}`);
        return { channel: "dev" as const };
      }
      throw retryError;
    }
  }
}
