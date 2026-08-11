import { NextResponse } from "next/server";
import { setDoctorTokenCookie } from "@/lib/auth/doctor";
import { insertClinicWithUniqueId } from "@/lib/clinic-registration";
import { withSentryApiRoute, captureApiError } from "@/lib/sentry-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DUPLICATE_EMAIL_MESSAGE,
  VERIFICATION_SESSION_MS,
} from "@/lib/otp";
import { trialEndsAtFromNow } from "@/lib/subscription";
import { normalizeEmail } from "@/lib/email";
import type { Clinic } from "@/lib/types";

type RegistrationBody = {
  doctor_name?: string;
  clinic_name?: string;
  email?: string;
  avg_time_per_patient?: number | string;
  consultation_fee?: number | string;
  clinic_hours?: string;
  google_review_link?: string;
  session_token?: string;
};

async function isEmailVerified(emailNormalized: string, sessionToken?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from("email_otp_requests")
    .select("verified_at, session_token")
    .eq("email_normalized", emailNormalized)
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

async function findExistingClinicByEmail(emailNormalized: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("clinics")
    .select("id")
    .ilike("email", emailNormalized)
    .limit(1)
    .maybeSingle();

  return data;
}

function parseRegistrationBody(body: RegistrationBody) {
  const doctorName = String(body.doctor_name ?? "").trim();
  const clinicName = String(body.clinic_name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const avgTimeRaw = Number(body.avg_time_per_patient);
  const consultationFeeRaw = Number(body.consultation_fee);
  const avgTime = Number.isFinite(avgTimeRaw) && avgTimeRaw > 0 ? avgTimeRaw : 10;
  const consultationFee =
    Number.isFinite(consultationFeeRaw) && consultationFeeRaw > 0
      ? consultationFeeRaw
      : 500;
  const clinicHours =
    String(body.clinic_hours ?? "").trim() || "Mon-Sat 9:00 AM - 8:00 PM";
  const googleReviewLink =
    String(body.google_review_link ?? "").trim() || null;
  const sessionToken = String(body.session_token ?? "").trim() || undefined;

  return {
    doctorName,
    clinicName,
    email,
    avgTime,
    consultationFee,
    clinicHours,
    googleReviewLink,
    sessionToken,
  };
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/clinics",
  async function POST(request: Request) {
    let body: RegistrationBody;

    try {
      body = (await request.json()) as RegistrationBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Expected JSON." },
        { status: 400 },
      );
    }

    try {
      const {
        doctorName,
        clinicName,
        email,
        avgTime,
        consultationFee,
        clinicHours,
        googleReviewLink,
        sessionToken,
      } = parseRegistrationBody(body);

      if (!doctorName || !clinicName || !email) {
        return NextResponse.json(
          { error: "Doctor name, clinic name, and email are required." },
          { status: 400 },
        );
      }

      const emailNormalized = normalizeEmail(email);
      const existingClinic = await findExistingClinicByEmail(emailNormalized);
      if (existingClinic) {
        return NextResponse.json(
          { error: DUPLICATE_EMAIL_MESSAGE, code: "TRIAL_ALREADY_USED" },
          { status: 400 },
        );
      }

      const emailVerified = await isEmailVerified(
        emailNormalized,
        sessionToken,
      );
      if (!emailVerified) {
        return NextResponse.json(
          {
            error:
              "Please verify your email address with the OTP before registering.",
            code: "EMAIL_NOT_VERIFIED",
          },
          { status: 400 },
        );
      }

      const trialStartedAt = new Date().toISOString();
      const trialEndsAt = trialEndsAtFromNow();

      const supabase = createAdminClient();
      const clinicRow = {
        doctor_name: doctorName,
        clinic_name: clinicName,
        email,
        phone: email,
        phone_normalized: null,
        avg_time_per_patient: Math.round(avgTime),
        consultation_fee: consultationFee,
        clinic_hours: clinicHours,
        google_review_link: googleReviewLink,
        whatsapp_number: null,
        subscription_status: "trialing",
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        subscription_amount: 999,
        subscription_currency: "INR",
        subscription_plan: "monthly_999",
        payment_provider: "cashfree",
      };

      const { data, error } = await insertClinicWithUniqueId<Clinic>(
        async (clinicId, row) =>
          supabase
            .from("clinics")
            .insert({ ...row, id: clinicId })
            .select()
            .single(),
        clinicRow,
      );

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message ?? "Registration failed." },
          { status: 500 },
        );
      }

      const response = NextResponse.json({ clinic: data }, { status: 201 });
      setDoctorTokenCookie(response, data.id);
      return response;
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Registration failed.",
        },
        { status: 500 },
      );
    }
  },
);
