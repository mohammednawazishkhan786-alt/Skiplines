import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { activateFromWebhookOrder } from "@/lib/cashfree-payment";
import {
  buildSubscriptionWebhookEventId,
} from "@/lib/subscription-webhook-id";
import { recordWebhookEvent } from "@/lib/payment-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extendMonthlyPeriod,
} from "@/lib/subscription-periods";
import {
  trialEndsAtFromNow,
  TRIAL_DAYS,
} from "@/lib/subscription";
import { captureApiError } from "@/lib/sentry-api";

type PgWebhookPayload = {
  type?: string;
  data?: {
    order?: {
      order_id?: string;
      order_tags?: Record<string, string>;
    };
    payment?: {
      payment_status?: string;
    };
  };
};

type SubscriptionWebhookPayload = {
  event_id?: string;
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

function normalizeEventType(type: string) {
  return type.trim().toUpperCase().replace(/-/g, "_");
}

function isPgPaymentSuccessEvent(eventType: string) {
  return (
    eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
    eventType === "PAYMENT_CHARGES_WEBHOOK" ||
    eventType === "ORDER_PAID"
  );
}

async function recordWebhookEventDeduped(
  input: Parameters<typeof recordWebhookEvent>[0],
): Promise<{ kind: "new" } | { kind: "duplicate" } | Response> {
  try {
    const recorded = await recordWebhookEvent(input);
    return recorded.duplicate ? { kind: "duplicate" } : { kind: "new" };
  } catch (error) {
    captureApiError(error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

function pgActivationResponse(
  result: Awaited<ReturnType<typeof activateFromWebhookOrder>>,
  duplicate: boolean,
) {
  if (!result.ok) {
    return Response.json({ status: result.status }, { status: 500 });
  }

  return Response.json({
    status: result.status,
    ...(duplicate ? { duplicate: true } : {}),
  });
}

function extractPgOrderId(payload: PgWebhookPayload) {
  return payload.data?.order?.order_id?.trim() ?? null;
}

function extractClinicIdFromPg(payload: PgWebhookPayload) {
  return payload.data?.order?.order_tags?.clinic_id?.trim() ?? null;
}

async function handlePgPaymentWebhook(payload: PgWebhookPayload, eventType: string) {
  const orderId = extractPgOrderId(payload);
  const clinicId = extractClinicIdFromPg(payload);

  if (!orderId) {
    return Response.json({ status: "missing_order_id" });
  }

  const eventId = `${eventType}:${orderId}`;
  const recordResult = await recordWebhookEventDeduped({
    eventId,
    eventType,
    clinicId,
    providerOrderId: orderId,
    payload,
  });
  if (recordResult instanceof Response) {
    return recordResult;
  }

  if (isPgPaymentSuccessEvent(eventType)) {
    const paymentStatus = String(
      payload.data?.payment?.payment_status ?? "",
    ).toUpperCase();

    if (paymentStatus && paymentStatus !== "SUCCESS") {
      return Response.json({ status: "ignored", reason: "payment_not_success" });
    }

    const result = await activateFromWebhookOrder(orderId);
    return pgActivationResponse(result, recordResult.kind === "duplicate");
  }

  if (
    eventType === "PAYMENT_FAILED_WEBHOOK" ||
    eventType === "PAYMENT_USER_DROPPED_WEBHOOK"
  ) {
    if (clinicId) {
      const supabase = createAdminClient();
      const { data: clinic } = await supabase
        .from("clinics")
        .select("subscription_status, subscription_expires_at, trial_ends_at")
        .eq("id", clinicId)
        .maybeSingle();

      if (clinic && !clinic.subscription_expires_at) {
        await supabase
          .from("clinics")
          .update({ subscription_status: "payment_failed" })
          .eq("id", clinicId);
      }
    }

    return Response.json({ status: "payment_failed_recorded" });
  }

  return Response.json({ status: "ignored", event: eventType });
}

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

async function handleSubscriptionWebhook(
  payload: SubscriptionWebhookPayload,
  rawBody: string,
) {
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

  const eventId = buildSubscriptionWebhookEventId(
    eventType,
    rawBody,
    payload.event_id,
  );

  const recordResult = await recordWebhookEventDeduped({
    eventId,
    eventType,
    clinicId,
    providerOrderId: subscriptionId,
    payload,
  });
  if (recordResult instanceof Response) {
    return recordResult;
  }
  if (recordResult.kind === "duplicate") {
    return Response.json({ status: "duplicate" });
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

    const currentStatus = clinic?.subscription_status?.toLowerCase() ?? "";

    if (currentStatus !== "active") {
      await supabase
        .from("clinics")
        .update({
          cashfree_subscription_id: subscriptionId,
          subscription_status: "trialing",
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
        subscription_expires_at: extendMonthlyPeriod(
          clinic?.subscription_expires_at,
        ).subscription_expires_at,
        current_period_start: extendMonthlyPeriod(
          clinic?.subscription_expires_at,
        ).current_period_start,
        current_period_end: extendMonthlyPeriod(
          clinic?.subscription_expires_at,
        ).current_period_end,
        next_billing_date: extendMonthlyPeriod(
          clinic?.subscription_expires_at,
        ).next_billing_date,
        last_payment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      .update({ subscription_status: "expired" })
      .eq("id", clinicId);

    return Response.json({ status: "subscription_expired" });
  }

  return Response.json({ status: "ignored", event: eventType });
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
    const payload = JSON.parse(rawBody) as PgWebhookPayload &
      SubscriptionWebhookPayload;
    const eventType = normalizeEventType(payload.type ?? "");

    if (
      eventType.startsWith("PAYMENT_") ||
      eventType === "ORDER_PAID"
    ) {
      return handlePgPaymentWebhook(payload, eventType);
    }

    return handleSubscriptionWebhook(payload, rawBody);
  } catch (error) {
    captureApiError(error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
