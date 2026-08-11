import {
  createOtpStoreClient,
  formatSupabaseError,
} from "@/lib/supabase/admin";
import { hashOtp, OTP_TTL_MS } from "@/lib/otp";

export { emailOtpMatches } from "@/lib/otp";

export type EmailOtpRecord = {
  id: string;
  email_normalized: string;
  otp_hash: string;
  expires_at: string;
  verified_at: string | null;
  session_token: string | null;
};

export async function upsertEmailOtp(emailNormalized: string, otp: string) {
  try {
    const supabase = createOtpStoreClient();
    const otpCode = otp.trim();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { error } = await supabase.from("email_otp_requests").upsert(
      {
        email_normalized: emailNormalized,
        otp_hash: hashOtp(emailNormalized, otpCode),
        expires_at: expiresAt,
        verified_at: null,
        session_token: null,
      },
      { onConflict: "email_normalized" },
    );

    if (error) {
      console.error("Supabase OTP Store Error:", error);
      throw new Error(
        formatSupabaseError(error, "Could not store OTP. Please try again."),
      );
    }
  } catch (error) {
    console.error("Supabase OTP Store Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Could not store OTP. Please try again.");
  }
}

export async function getEmailOtpRecord(emailNormalized: string) {
  try {
    const supabase = createOtpStoreClient();

    const { data, error } = await supabase
      .from("email_otp_requests")
      .select(
        "id, email_normalized, otp_hash, expires_at, verified_at, session_token",
      )
      .eq("email_normalized", emailNormalized)
      .maybeSingle();

    if (error) {
      console.error("Supabase OTP Store Error:", error);
      throw new Error(
        formatSupabaseError(error, "Could not verify OTP. Please try again."),
      );
    }

    return data as EmailOtpRecord | null;
  } catch (error) {
    console.error("Supabase OTP Store Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Could not verify OTP. Please try again.");
  }
}

export async function invalidateEmailOtp(
  recordId: string,
  sessionToken: string,
) {
  try {
    const supabase = createOtpStoreClient();
    const verifiedAt = new Date().toISOString();

    const { error } = await supabase
      .from("email_otp_requests")
      .update({
        otp_hash: "INVALIDATED",
        verified_at: verifiedAt,
        session_token: sessionToken,
        expires_at: verifiedAt,
      })
      .eq("id", recordId);

    if (error) {
      console.error("Supabase OTP Store Error:", error);
      throw new Error(
        formatSupabaseError(
          error,
          "OTP verified but session could not be saved.",
        ),
      );
    }

    return verifiedAt;
  } catch (error) {
    console.error("Supabase OTP Store Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("OTP verified but session could not be saved.");
  }
}
