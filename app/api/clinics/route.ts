import { NextResponse } from "next/server";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DUPLICATE_PHONE_MESSAGE,
  VERIFICATION_SESSION_MS,
} from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import type { ClinicRegistrationInput } from "@/lib/types";

async function isPhoneVerified(phoneNormalized: string, sessionToken?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("phone_otp_requests")
    .select("verified_at, session_token")
    .eq("phone_normalized", phoneNormalized)
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(1);

  if (sessionToken) {
    query = query.eq("session_token", sessionToken);
  }

  const { data } = await query.maybeSingle();

  if (!data?.verified_at) {
    return false;
  }

  if (sessionToken && data.session_token !== sessionToken) {
    return false;
  }

  const verifiedAt = new Date(data.verified_at).getTime();
  return Date.now() - verifiedAt < VERIFICATION_SESSION_MS;
}

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
  "/api/clinics",
  async function POST(request: Request) {
    try {
      const body = (await request.json()) as ClinicRegistrationInput & {
        session_token?: string;
      };

      const doctorName = body.doctor_name?.trim();
      const clinicName = body.clinic_name?.trim();
      const email = body.email?.trim();
      const phone = body.phone?.trim();
      const avgTime = Number(body.avg_time_per_patient);
      const consultationFee = Number(body.consultation_fee ?? 500);
      const clinicHours =
        body.clinic_hours?.trim() ?? "Mon-Sat 9:00 AM - 8:00 PM";
      const googleReviewLink = body.google_review_link?.trim() || null;

      if (!doctorName || !clinicName || !email || !phone) {
        return NextResponse.json(
          { error: "All fields are required." },
          { status: 400 },
        );
      }

      if (!Number.isFinite(avgTime) || avgTime <= 0) {
        return NextResponse.json(
          { error: "Average time per patient must be a positive number." },
          { status: 400 },
        );
      }

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

      const phoneVerified = await isPhoneVerified(
        phoneNormalized,
        body.session_token,
      );
      if (!phoneVerified) {
        return NextResponse.json(
          {
            error:
              "Please verify your mobile number with WhatsApp OTP before registering.",
            code: "PHONE_NOT_VERIFIED",
          },
          { status: 400 },
        );
      }

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("clinics")
        .insert({
          doctor_name: doctorName,
          clinic_name: clinicName,
          email,
          phone,
          phone_normalized: phoneNormalized,
          avg_time_per_patient: Math.round(avgTime),
          consultation_fee: consultationFee,
          clinic_hours: clinicHours,
          google_review_link: googleReviewLink,
          whatsapp_number: phoneNormalized,
          subscription_status: "pending_mandate",
          trial_ends_at: null,
          trial_started_at: null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ clinic: data }, { status: 201 });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
  },
);
