import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createVerificationSessionToken,
  hashOtp,
  VERIFICATION_SESSION_MS,
} from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/otp/verify",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const phone = String(body.phone ?? "").trim();
      const otp = String(body.otp ?? "").trim();
      const phoneNormalized = normalizePhone(phone);

      if (phoneNormalized.length < 10 || otp.length !== 6) {
        return NextResponse.json(
          { error: "Enter your 10-digit mobile number and 6-digit OTP." },
          { status: 400 },
        );
      }

      const supabase = createAdminClient();
      const { data: record } = await supabase
        .from("phone_otp_requests")
        .select("id, otp_hash, expires_at, verified_at, session_token")
        .eq("phone_normalized", phoneNormalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!record) {
        return NextResponse.json(
          { error: "No OTP found. Please request a new WhatsApp OTP." },
          { status: 400 },
        );
      }

      if (record.verified_at && record.session_token) {
        const verifiedAt = new Date(record.verified_at).getTime();
        if (Date.now() - verifiedAt < VERIFICATION_SESSION_MS) {
          return NextResponse.json({
            verified: true,
            session_token: record.session_token,
            message: "Phone already verified.",
          });
        }
      }

      if (new Date(record.expires_at) < new Date()) {
        return NextResponse.json(
          { error: "OTP expired. Please request a new WhatsApp OTP." },
          { status: 400 },
        );
      }

      if (record.otp_hash !== hashOtp(phoneNormalized, otp)) {
        return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
      }

      const sessionToken = createVerificationSessionToken();
      const verifiedAt = new Date().toISOString();

      await supabase
        .from("phone_otp_requests")
        .update({
          verified_at: verifiedAt,
          session_token: sessionToken,
        })
        .eq("id", record.id);

      return NextResponse.json({
        verified: true,
        session_token: sessionToken,
        message: "WhatsApp number verified successfully.",
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "OTP verify failed." },
        { status: 500 },
      );
    }
  },
);
