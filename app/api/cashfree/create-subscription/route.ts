import { NextResponse } from "next/server";
import { createCashfreeSubscription } from "@/lib/cashfree-subscriptions";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/create-subscription",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const clinicId = body.clinic_id as string;
      const skipTrial = Boolean(body.skip_trial);

      if (!clinicId) {
        return NextResponse.json(
          { error: "clinic_id is required." },
          { status: 400 },
        );
      }

      const supabase = await createClient();
      const { data: clinic, error } = await supabase
        .from("clinics")
        .select(
          "id, email, phone, doctor_name, clinic_name, subscription_status, cashfree_subscription_id",
        )
        .eq("id", clinicId)
        .single();

      if (error || !clinic) {
        return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
      }

      const status = clinic.subscription_status.toUpperCase();
      if (status === "ACTIVE" || status === "ACTIVE_TRIAL") {
        return NextResponse.json({
          message: "Subscription is already active.",
          status: clinic.subscription_status,
          subscription_id: clinic.cashfree_subscription_id,
        });
      }

      const subscription = await createCashfreeSubscription({
        clinicId: clinic.id,
        email: clinic.email,
        phone: clinic.phone,
        doctorName: clinic.doctor_name,
        clinicName: clinic.clinic_name,
        skipTrial,
      });

      await supabase
        .from("clinics")
        .update({
          cashfree_subscription_id: subscription.subscription_id,
          subscription_status: "pending_mandate",
        })
        .eq("id", clinicId);

      return NextResponse.json({
        subscription_id: subscription.subscription_id,
        subscription_session_id: subscription.subscription_session_id,
        plan: "₹999/month",
        auth_amount: 1,
        trial_days: skipTrial ? 0 : 7,
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Subscription creation failed.",
        },
        { status: 500 },
      );
    }
  },
);
