import {
  fetchCashfreeOrder,
  isCashfreeOrderPaid,
  resolveSkipelinesSubscriptionAmount,
  SKIPLINES_SUBSCRIPTION_CURRENCY,
} from "@/lib/cashfree";
import { upsertPaymentTransaction } from "@/lib/payment-audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionAmountInr } from "@/lib/subscription-access";
import {
  extendMonthlyPeriod,
  resolveSubscriptionPlan,
  SUBSCRIPTION_CURRENCY,
} from "@/lib/subscription-periods";
import { isPaidSubscriptionActive } from "@/lib/subscription";

type ClinicPaymentRow = {
  id: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  cashfree_order_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  last_payment_at: string | null;
};

export async function activateClinicSubscription(
  clinicId: string,
  orderId: string,
) {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("clinics")
    .select(
      "subscription_expires_at, cashfree_order_id, subscription_status, current_period_end",
    )
    .eq("id", clinicId)
    .single();

  if (!existing) {
    return {
      ok: false as const,
      status: 404,
      error: "Clinic not found.",
    };
  }

  if (isPaidSubscriptionActive(existing)) {
    if (existing.cashfree_order_id === orderId) {
      return {
        ok: true as const,
        status: 200,
        clinic: existing as ClinicPaymentRow,
        message: "Subscription is already active for this payment.",
        alreadyActive: true as const,
      };
    }

    return {
      ok: true as const,
      status: 200,
      clinic: existing as ClinicPaymentRow,
      message: "Subscription is already active.",
      alreadyActive: true as const,
    };
  }

  const period = extendMonthlyPeriod(existing.current_period_end);
  const now = new Date().toISOString();
  const amount = getSubscriptionAmountInr();
  const plan = resolveSubscriptionPlan();

  const { data: clinic, error } = await supabase
    .from("clinics")
    .update({
      cashfree_order_id: orderId,
      subscription_status: "active",
      subscription_amount: amount,
      subscription_currency: SUBSCRIPTION_CURRENCY,
      subscription_plan: plan,
      payment_provider: "cashfree",
      subscription_expires_at: period.subscription_expires_at,
      current_period_start: period.current_period_start,
      current_period_end: period.current_period_end,
      next_billing_date: period.next_billing_date,
      last_payment_at: period.last_payment_at,
      expired_at: null,
      updated_at: now,
    })
    .eq("id", clinicId)
    .select(
      "id, subscription_status, subscription_expires_at, cashfree_order_id, current_period_start, current_period_end, next_billing_date, last_payment_at",
    )
    .single();

  if (error || !clinic) {
    return {
      ok: false as const,
      status: 500,
      error: "Could not update subscription in database.",
    };
  }

  await upsertPaymentTransaction({
    clinicId,
    providerOrderId: orderId,
    amount,
    currency: SKIPLINES_SUBSCRIPTION_CURRENCY,
    status: "success",
    eventType: "payment_success",
  });

  return {
    ok: true as const,
    status: 200,
    clinic: clinic as ClinicPaymentRow,
    message: "Payment successful — Skiplines unlocked for 1 month.",
    alreadyActive: false as const,
  };
}

function extractClinicIdFromOrderTags(
  tags: Record<string, string> | undefined | null,
) {
  return tags?.clinic_id?.trim() || null;
}

export async function verifyAndActivatePayment(clinicId: string, orderId: string) {
  const supabase = createAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, subscription_status, subscription_expires_at, cashfree_order_id")
    .eq("id", clinicId)
    .maybeSingle();

  if (!clinic) {
    return {
      ok: false as const,
      status: 404,
      error: "Clinic not found.",
    };
  }

  if (
    isPaidSubscriptionActive(clinic) &&
    clinic.cashfree_order_id &&
    clinic.cashfree_order_id !== orderId
  ) {
    return {
      ok: false as const,
      status: 409,
      error: "Subscription is already active.",
      paymentStatus: "duplicate" as const,
    };
  }

  if (isPaidSubscriptionActive(clinic) && clinic.cashfree_order_id === orderId) {
    return {
      ok: true as const,
      status: 200,
      clinic: clinic as ClinicPaymentRow,
      message: "Subscription is already active for this payment.",
      alreadyActive: true as const,
    };
  }

  let order;
  try {
    order = await fetchCashfreeOrder(orderId);
  } catch {
    return {
      ok: false as const,
      status: 502,
      error: "Could not verify payment with Cashfree.",
    };
  }

  const taggedClinicId = extractClinicIdFromOrderTags(
    order.order_tags as Record<string, string> | undefined,
  );
  if (taggedClinicId && taggedClinicId !== clinicId) {
    return {
      ok: false as const,
      status: 403,
      error: "This payment does not belong to your clinic.",
    };
  }

  const expectedAmount = resolveSkipelinesSubscriptionAmount();
  const orderAmount = Number(order.order_amount);
  if (orderAmount !== expectedAmount) {
    return {
      ok: false as const,
      status: 400,
      error: "Invalid payment amount.",
    };
  }

  const orderStatus = String(order.order_status ?? "").toUpperCase();
  if (orderStatus === "EXPIRED" || orderStatus === "TERMINATED") {
    return {
      ok: false as const,
      status: 410,
      error: "Payment session expired. Please start a new payment.",
      paymentStatus: "expired" as const,
    };
  }

  const paid = await isCashfreeOrderPaid(orderId);
  if (!paid) {
    return {
      ok: false as const,
      status: 402,
      error: "Payment not completed yet.",
      paymentStatus: "pending" as const,
    };
  }

  return activateClinicSubscription(clinicId, orderId);
}

export async function activateFromWebhookOrder(orderId: string) {
  let order;
  try {
    order = await fetchCashfreeOrder(orderId);
  } catch {
    return { ok: false as const, status: "order_fetch_failed" as const };
  }

  const clinicId = extractClinicIdFromOrderTags(
    order.order_tags as Record<string, string> | undefined,
  );
  if (!clinicId) {
    return { ok: false as const, status: "missing_clinic" as const };
  }

  const expectedAmount = resolveSkipelinesSubscriptionAmount();
  const orderAmount = Number(order.order_amount);
  if (orderAmount !== expectedAmount) {
    return { ok: false as const, status: "invalid_amount" as const };
  }

  const paid = await isCashfreeOrderPaid(orderId);
  if (!paid) {
    return { ok: false as const, status: "not_paid" as const };
  }

  const result = await activateClinicSubscription(clinicId, orderId);
  if (!result.ok) {
    return { ok: false as const, status: "activation_failed" as const };
  }

  return {
    ok: true as const,
    status: result.alreadyActive ? "already_active" : "activated",
    clinicId,
    orderId,
  };
}
