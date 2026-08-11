import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import {
  createSubscriptionOrder,
  resolveSkipelinesSubscriptionAmount,
} from "@/lib/cashfree";
import { sanitizeCashfreeErrorMessage } from "@/lib/cashfree-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertCashfreeCheckoutEnvironment,
  getCashfreeCheckoutMode,
  getPublicAppUrl,
} from "@/lib/env";
import { isSubscriptionTestMode } from "@/lib/subscription-access";
import {
  isPaidSubscriptionActive,
  isTrialActive,
} from "@/lib/subscription";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/create-order",
  async function POST(request: Request) {
    try {
      const configError = assertCashfreeCheckoutEnvironment();
      if (configError) {
        console.error(`[cashfree] checkout config error: ${configError}`);
        return NextResponse.json(
          { success: false, error: configError },
          { status: 500 },
        );
      }

      const cashfreeMode = getCashfreeCheckoutMode();
      if (!isSubscriptionTestMode() && cashfreeMode !== "production") {
        return NextResponse.json(
          {
            success: false,
            error: "Live payments require Cashfree production mode.",
          },
          { status: 500 },
        );
      }

      const body = await request.json();
      const clinicId = body.clinic_id as string;

      if (!clinicId) {
        return NextResponse.json(
          { success: false, error: "clinic_id is required." },
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
        .select(
          "id, email, phone, doctor_name, clinic_name, subscription_status, subscription_expires_at, trial_ends_at, cashfree_order_id",
        )
        .eq("id", clinicId)
        .single();

      if (error || !clinic) {
        return NextResponse.json(
          { success: false, error: "Clinic not found." },
          { status: 404 },
        );
      }

      if (isPaidSubscriptionActive(clinic)) {
        return NextResponse.json(
          {
            success: false,
            error: "Subscription is already active.",
            status: clinic.subscription_status,
          },
          { status: 409 },
        );
      }

      const order = await createSubscriptionOrder({
        clinicId: clinic.id,
        email: clinic.email,
        phone: clinic.phone,
        doctorName: clinic.doctor_name,
        clinicName: clinic.clinic_name,
      });

      const paymentSessionId = order.payment_session_id?.trim();
      if (!paymentSessionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Cashfree did not return a payment session ID.",
          },
          { status: 502 },
        );
      }

      await supabase
        .from("clinics")
        .update({
          cashfree_order_id: order.order_id,
          ...(isTrialActive(clinic)
            ? {}
            : { subscription_status: "pending_payment" }),
        })
        .eq("id", clinicId);

      const appUrl = getPublicAppUrl();
      const returnUrl = `${appUrl}/dashboard?clinic=${clinicId}&order_id=${order.order_id}`;

      const amount = resolveSkipelinesSubscriptionAmount();
      const periodLabel = isSubscriptionTestMode() ? "1 minute" : "1 month";

      return NextResponse.json({
        success: true,
        order_id: order.order_id,
        payment_session_id: paymentSessionId,
        cashfree_mode: cashfreeMode,
        order_status: order.order_status,
        amount,
        plan: `₹${amount} for ${periodLabel}`,
        return_url: returnUrl,
        subscription_test_mode: isSubscriptionTestMode(),
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          success: false,
          error: sanitizeCashfreeErrorMessage(
            error instanceof Error ? error.message : "Order creation failed.",
          ),
        },
        { status: 500 },
      );
    }
  },
);
