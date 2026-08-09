import { NextResponse } from "next/server";
import { fetchCashfreeSubscription } from "@/lib/cashfree-subscriptions";
import { createClient } from "@/lib/supabase/server";
import { captureApiError, withSentryApiRoute } from "@/lib/sentry-api";

function isMandateAuthorized(subscription: Record<string, unknown>) {
  const status = String(subscription.subscription_status ?? "").toUpperCase();
  const authDetails = subscription.authorisation_details as
    | Record<string, unknown>
    | undefined;
  const authorizationDetails = subscription.authorization_details as
    | Record<string, unknown>
    | undefined;
  const auth = authDetails ?? authorizationDetails;
  const authStatus = String(auth?.authorization_status ?? "").toUpperCase();

  return (
    authStatus === "SUCCESS" ||
    status === "ACTIVE" ||
    status === "BANK_APPROVAL_PENDING"
  );
}

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/verify-subscription",
  async function POST(request: Request) {
    try {
      const body = await request.json();
      const clinicId = body.clinic_id as string;
      const subscriptionId = body.subscription_id as string;

      if (!clinicId || !subscriptionId) {
        return NextResponse.json(
          { error: "clinic_id and subscription_id are required." },
          { status: 400 },
        );
      }

      const subscription = await fetchCashfreeSubscription(subscriptionId);
      const supabase = await createClient();
      const { data: clinic } = await supabase
        .from("clinics")
        .select("subscription_status")
        .eq("id", clinicId)
        .single();

      if (!clinic) {
        return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
      }

      if (!isMandateAuthorized(subscription)) {
        return NextResponse.json({
          status: clinic.subscription_status,
          mandate_authorized: false,
          message:
            "Mandate authorization is pending. Complete the ₹1 UPI payment to activate your trial.",
        });
      }

      return NextResponse.json({
        status: clinic.subscription_status,
        mandate_authorized: true,
        message:
          "Mandate authorized. Your trial will activate shortly once Cashfree confirms payment.",
      });
    } catch (error) {
      captureApiError(error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Subscription verification failed.",
        },
        { status: 500 },
      );
    }
  },
);
