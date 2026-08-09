import { NextResponse } from "next/server";
import { isCashfreeOrderPaid } from "@/lib/cashfree";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/verify",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const clinicId = body.clinic_id as string;
      const orderId = body.order_id as string;

      if (!clinicId || !orderId) {
        return NextResponse.json(
          { error: "clinic_id and order_id are required." },
          { status: 400 },
        );
      }

      const paid = await isCashfreeOrderPaid(orderId);
      if (!paid) {
        return NextResponse.json(
          { error: "Payment not completed yet.", status: "pending" },
          { status: 402 },
        );
      }

      const supabase = await createClient();
      const { data: clinic, error } = await supabase
        .from("clinics")
        .update({
          cashfree_order_id: orderId,
          subscription_status: "active",
        })
        .eq("id", clinicId)
        .select("id, subscription_status, cashfree_order_id")
        .single();

      if (error || !clinic) {
        return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
      }

      return NextResponse.json({
        status: clinic.subscription_status,
        order_id: clinic.cashfree_order_id,
        message: "Subscription activated successfully.",
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Payment verification failed.",
        },
        { status: 500 },
      );
    }
  },
);
