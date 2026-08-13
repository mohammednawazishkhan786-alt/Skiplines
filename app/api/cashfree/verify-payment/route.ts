import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import {
  cleanDashboardUrl,
  sanitizeCashfreeErrorMessage,
} from "@/lib/cashfree-navigation";
import { verifyAndActivatePayment } from "@/lib/cashfree-payment";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidSubscriptionActive } from "@/lib/subscription";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

function redirectToDashboard(clinicId: string | null) {
  return NextResponse.redirect(cleanDashboardUrl(clinicId));
}

async function handlePaymentVerification(
  request: Request,
  clinicId: string,
  orderId: string,
  redirectOnResult: boolean,
) {
  const supabase = createAdminClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("subscription_status, trial_ends_at, subscription_expires_at")
    .eq("id", clinicId)
    .maybeSingle();

  if (clinic && isPaidSubscriptionActive(clinic)) {
    if (redirectOnResult) {
      return redirectToDashboard(clinicId);
    }

    return NextResponse.json({
      status: clinic.subscription_status,
      message: "Your subscription is already active.",
      skipped: true,
    });
  }

  const authError = requireDoctorAuth(request, clinicId);
  if (authError) {
    if (redirectOnResult) {
      return redirectToDashboard(clinicId);
    }
    return authError;
  }

  try {
    const result = await verifyAndActivatePayment(clinicId, orderId);

    if (!result.ok) {
      if (redirectOnResult) {
        return redirectToDashboard(clinicId);
      }

      return NextResponse.json(
        {
          error: result.error,
          ...("paymentStatus" in result && result.paymentStatus
            ? { status: result.paymentStatus }
            : {}),
        },
        { status: result.status },
      );
    }

    if (redirectOnResult) {
      return redirectToDashboard(clinicId);
    }

    return NextResponse.json({
      status: result.clinic.subscription_status,
      order_id: result.clinic.cashfree_order_id,
      subscription_expires_at: result.clinic.subscription_expires_at,
      message: result.message,
    });
  } catch (error) {
    captureApiError(error);

    if (redirectOnResult) {
      return redirectToDashboard(clinicId);
    }

    const message =
      error instanceof Error ? error.message : "Payment verification failed.";

    return NextResponse.json(
      { error: sanitizeCashfreeErrorMessage(message) },
      { status: 500 },
    );
  }
}

export const GET = withSentryApiRoute(
  "GET",
  "/api/cashfree/verify-payment",
  async function GET(request: Request) {
    const url = new URL(request.url);
    const clinicId =
      url.searchParams.get("clinic_id") ?? url.searchParams.get("clinic");
    const orderId = url.searchParams.get("order_id");
    const paymentSessionId = url.searchParams.get("payment_session_id");

    if (!orderId && !paymentSessionId) {
      return redirectToDashboard(clinicId);
    }

    if (!clinicId || !orderId) {
      return redirectToDashboard(clinicId);
    }

    return handlePaymentVerification(request, clinicId, orderId, true);
  },
);

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/verify-payment",
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

      return handlePaymentVerification(request, clinicId, orderId, false);
    } catch (error) {
      captureApiError(error);
      const message =
        error instanceof Error ? error.message : "Payment verification failed.";

      return NextResponse.json(
        { error: sanitizeCashfreeErrorMessage(message) },
        { status: 500 },
      );
    }
  },
);
