import { NextResponse } from "next/server";
import { createSubscriptionOrder } from "@/lib/cashfree";
import { createClient } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/env";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/create-order",
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

      const supabase = await createClient();
      const { data: clinic, error } = await supabase
        .from("clinics")
        .select(
          "id, email, phone, doctor_name, clinic_name, subscription_status, cashfree_order_id",
        )
        .eq("id", clinicId)
        .single();

      if (error || !clinic) {
        return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
      }

      if (clinic.subscription_status === "active") {
        return NextResponse.json({
          message: "Subscription is already active.",
          status: clinic.subscription_status,
          order_id: clinic.cashfree_order_id,
        });
      }

      const order = await createSubscriptionOrder({
        clinicId: clinic.id,
        email: clinic.email,
        phone: clinic.phone,
        doctorName: clinic.doctor_name,
        clinicName: clinic.clinic_name,
      });

      await supabase
        .from("clinics")
        .update({
          cashfree_order_id: order.order_id,
          subscription_status: "pending_payment",
        })
        .eq("id", clinicId);

      const appUrl = getPublicAppUrl();

      return NextResponse.json({
        order_id: order.order_id,
        payment_session_id: order.payment_session_id,
        order_status: order.order_status,
        plan: "₹999/month",
        trial_days: 7,
        return_url: `${appUrl}/dashboard?clinic=${clinicId}&payment=success&order_id=${order.order_id}`,
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Order creation failed.",
        },
        { status: 500 },
      );
    }
  },
);
