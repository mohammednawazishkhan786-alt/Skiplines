import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import { hasDashboardAccess } from "@/lib/subscription";
import { withSentryApiRoute } from "@/lib/sentry-api";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Doctor dashboard fields — never returned on public patient APIs. */
const DOCTOR_CLINIC_SELECT =
  "id, doctor_name, clinic_name, email, phone, avg_time_per_patient, current_token, consultation_fee, clinic_hours, google_review_link, whatsapp_number, subscription_status, trial_ends_at, trial_started_at, subscription_expires_at, current_period_start, current_period_end, next_billing_date, last_payment_at, subscription_amount, subscription_currency, subscription_plan, cancelled_at, expired_at, cashfree_order_id, created_at, updated_at" as const;

const DOCTOR_TOKEN_SELECT =
  "id, clinic_id, token_number, queue_position, status, patient_name, patient_phone, is_emergency, is_late, estimated_call_at, completed_at, late_shift_count, created_at" as const;

export const GET = withSentryApiRoute(
  "GET",
  "/api/clinics/[id]",
  async function GET(request: Request, context: RouteContext) {
    const { id } = await context.params;

    const authError = requireDoctorAuth(request, id);
    if (authError) {
      return authError;
    }

    const supabase = createAdminClient();

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select(DOCTOR_CLINIC_SELECT)
      .eq("id", id)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    }

    if (!hasDashboardAccess(clinic)) {
      return NextResponse.json({
        clinic,
        waiting: [],
        currentlyServing: null,
        subscription_locked: true,
      });
    }

    const { data: waiting, error: waitingError } = await supabase
      .from("tokens")
      .select(DOCTOR_TOKEN_SELECT)
      .eq("clinic_id", id)
      .eq("status", "waiting")
      .order("queue_position", { ascending: true });

    if (waitingError) {
      return NextResponse.json({ error: waitingError.message }, { status: 500 });
    }

    const { data: called, error: calledError } = await supabase
      .from("tokens")
      .select(DOCTOR_TOKEN_SELECT)
      .eq("clinic_id", id)
      .eq("status", "called")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (calledError) {
      return NextResponse.json({ error: calledError.message }, { status: 500 });
    }

    return NextResponse.json({
      clinic,
      waiting: waiting ?? [],
      currentlyServing: called,
    });
  },
);
