import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extendSubscriptionExpiry,
  trialEndsAtFromNow,
  TRIAL_DAYS,
} from "@/lib/subscription";
import { captureApiError } from "@/lib/sentry-api";

type SubscriptionWebhookPayload = {
  type?: string;
  data?: {
    subscription_details?: {
      subscription_id?: string;
      subscription_status?: string;
      cf_subscription_id?: string;
    };
    subscription_tags?: Record<string, string>;
    payment_details?: {
      payment_amount?: number;
      payment_status?: string;
    };
    authorization_details?: {
      authorization_status?: string;
    };
  };
};

function extractClinicId(payload: SubscriptionWebhookPayload) {
  const tags = payload.data?.subscription_tags;
  if (tags?.clinic_id) {
    return tags.clinic_id;
  }
  return null;
}

function extractSubscriptionId(payload: SubscriptionWebhookPayload) {
  return payload.data?.subscription_details?.subscription_id ?? null;
}

function normalizeEventType(type: string) {
  return type.trim().toUpperCase().replace(/-/g, "_");
}

export async function handleCashfreeWebhook(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  try {
    verifyCashfreeWebhook(signature, rawBody, timestamp);
  } catch (error) {
    captureApiError(error);
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as SubscriptionWebhookPayload;
    const eventType = normalizeEventType(payload.type ?? "");
    const subscriptionId = extractSubscriptionId(payload);
    const clinicIdFromTags = extractClinicId(payload);

    const supabase = createAdminClient();

    let clinicId = clinicIdFromTags;
    if (!clinicId && subscriptionId) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("id")
        .eq("cashfree_subscription_id", subscriptionId)
        .maybeSingle();
      clinicId = clinic?.id ?? null;
    }

    if (!clinicId) {
      return Response.json({ status: "missing_clinic" });
    }

    const subscriptionStatus = String(
      payload.data?.subscription_details?.subscription_status ?? "",
    ).toUpperCase();

    if (
      eventType === "SUBSCRIPTION_ACTIVE" ||
      (eventType === "SUBSCRIPTION_AUTH_STATUS" &&
        payload.data?.authorization_details?.authorization_status?.toUpperCase() ===
          "SUCCESS") ||
      (eventType === "SUBSCRIPTION_STATUS_CHANGED" &&
        subscriptionStatus === "ACTIVE" &&
        payload.data?.authorization_details?.authorization_status?.toUpperCase() ===
          "SUCCESS")
    ) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("subscription_status")
        .eq("id", clinicId)
        .single();

      const currentStatus = clinic?.subscription_status?.toUpperCase() ?? "";

      if (currentStatus !== "ACTIVE") {
        await supabase
          .from("clinics")
          .update({
            cashfree_subscription_id: subscriptionId,
            subscription_status: "ACTIVE_TRIAL",
            trial_started_at: new Date().toISOString(),
            trial_ends_at: trialEndsAtFromNow(TRIAL_DAYS),
          })
          .eq("id", clinicId);
      }

      return Response.json({ status: "trial_activated" });
    }

    if (
      eventType === "SUBSCRIPTION_CHARGED" ||
      eventType === "SUBSCRIPTION_PAYMENT_SUCCESS"
    ) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("subscription_expires_at")
        .eq("id", clinicId)
        .single();

      await supabase
        .from("clinics")
        .update({
          subscription_status: "active",
          subscription_expires_at: extendSubscriptionExpiry(
            clinic?.subscription_expires_at,
          ),
        })
        .eq("id", clinicId);

      return Response.json({ status: "subscription_extended" });
    }

    if (
      eventType === "SUBSCRIPTION_CANCELLED" ||
      eventType === "SUBSCRIPTION_FAILED" ||
      eventType === "SUBSCRIPTION_PAYMENT_FAILED" ||
      eventType === "SUBSCRIPTION_PAYMENT_CANCELLED" ||
      (eventType === "SUBSCRIPTION_STATUS_CHANGED" &&
        ["CUSTOMER_CANCELLED", "CANCELLED", "EXPIRED", "FAILED"].includes(
          subscriptionStatus,
        ))
    ) {
      await supabase
        .from("clinics")
        .update({ subscription_status: "EXPIRED" })
        .eq("id", clinicId);

      return Response.json({ status: "subscription_expired" });
    }

    return Response.json({ status: "ignored", event: eventType });
  } catch (error) {
    captureApiError(error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
