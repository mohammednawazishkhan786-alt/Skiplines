import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import { verifyAndActivatePayment } from "@/lib/cashfree-payment";
import { sanitizeCashfreeErrorMessage } from "@/lib/cashfree-navigation";
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

      const authError = requireDoctorAuth(request, clinicId);
      if (authError) {
        return authError;
      }

      const result = await verifyAndActivatePayment(clinicId, orderId);
      if (!result.ok) {
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

      return NextResponse.json({
        status: result.clinic.subscription_status,
        order_id: result.clinic.cashfree_order_id,
        subscription_expires_at: result.clinic.subscription_expires_at,
        message: result.message,
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error: sanitizeCashfreeErrorMessage(
            error instanceof Error ? error.message : "Payment verification failed.",
          ),
        },
        { status: 500 },
      );
    }
  },
);
