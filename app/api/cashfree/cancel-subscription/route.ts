import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import { cancelCashfreeSubscription } from "@/lib/cashfree-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/cancel-subscription",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const clinicId = body.clinic_id as string;

      if (!clinicId) {
        return NextResponse.json(
          { error: "clinic_id is required." },
          { status: 400 },
        );
      }

      const authError = requireDoctorAuth(request, clinicId);
      if (authError) {
        return authError;
      }

      const supabase = createAdminClient();
      const { data: clinic, error } = await supabase
        .from("clinics")
        .select("id, cashfree_subscription_id, subscription_status")
        .eq("id", clinicId)
        .single();

      if (error || !clinic) {
        return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
      }

      if (!clinic.cashfree_subscription_id) {
        return NextResponse.json(
          { error: "No active Cashfree subscription found." },
          { status: 400 },
        );
      }

      await cancelCashfreeSubscription(clinic.cashfree_subscription_id);

      await supabase
        .from("clinics")
        .update({ subscription_status: "EXPIRED" })
        .eq("id", clinicId);

      return NextResponse.json({
        message: "Subscription cancelled. Your UPI mandate has been revoked.",
        status: "EXPIRED",
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Subscription cancellation failed.",
        },
        { status: 500 },
      );
    }
  },
);
