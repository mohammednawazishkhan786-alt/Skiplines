import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ClinicRegistrationInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClinicRegistrationInput;

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

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clinics")
      .insert({
        doctor_name: doctorName,
        clinic_name: clinicName,
        email,
        phone,
        avg_time_per_patient: Math.round(avgTime),
        consultation_fee: consultationFee,
        clinic_hours: clinicHours,
        google_review_link: googleReviewLink,
        whatsapp_number: phone.replace(/\D/g, ""),
        subscription_status: "trial",
        trial_ends_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clinic: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
}
