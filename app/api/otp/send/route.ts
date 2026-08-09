import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deliverOtp,
  DUPLICATE_PHONE_MESSAGE,
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
} from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

async function findExistingClinicByPhone(phoneNormalized: string) {
  const supabase = createAdminClient();

  const { data: byNormalized } = await supabase
    .from("clinics")
    .select("id")
    .eq("phone_normalized", phoneNormalized)
    .limit(1)
    .maybeSingle();

  if (byNormalized) {
    return byNormalized;
  }

  const { data: byPhoneSuffix } = await supabase
    .from("clinics")
    .select("id")
    .or(
      `phone.ilike.%${phoneNormalized},phone.ilike.%+91${phoneNormalized},phone.ilike.%91${phoneNormalized}`,
    )
    .limit(1)
    .maybeSingle();

  return byPhoneSuffix;
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/otp/send",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const phone = String(body.phone ?? "").trim();
      const phoneNormalized = normalizePhone(phone);

      if (phoneNormalized.length < 10) {
        return NextResponse.json(
          { error: "Please enter a valid 10-digit mobile number." },
          { status: 400 },
        );
      }

      const existingClinic = await findExistingClinicByPhone(phoneNormalized);
      if (existingClinic) {
        return NextResponse.json(
          { error: DUPLICATE_PHONE_MESSAGE, code: "TRIAL_ALREADY_USED" },
          { status: 400 },
        );
      }

      const otp = generateOtp();
      const delivery = await deliverOtp(phoneNormalized, otp);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      const supabase = createAdminClient();
      await supabase.from("phone_otp_requests").insert({
        phone_normalized: phoneNormalized,
        otp_hash: hashOtp(phoneNormalized, otp),
        expires_at: expiresAt,
      });

      return NextResponse.json({
        message:
          delivery.channel === "whatsapp"
            ? `WhatsApp OTP sent to +91 ${phoneNormalized}. Valid for 5 minutes.`
            : "Development mode: OTP shown below (WhatsApp API bypass enabled).",
        channel: delivery.channel,
        expires_in_seconds: OTP_TTL_MS / 1000,
        dev_otp: delivery.devOtp,
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Could not send OTP.",
        },
        { status: 500 },
      );
    }
  },
);
