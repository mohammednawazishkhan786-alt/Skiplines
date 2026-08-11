import {
  getCashfreeAppId,
  getCashfreeMode,
  getCashfreeSecretKey,
  getPublicAppUrl,
} from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import {
  firstChargeTimeFromNow,
  TRIAL_DAYS,
} from "@/lib/subscription";

export const SKIPLINES_PLAN_AMOUNT = 999;
export const SKIPLINES_AUTH_AMOUNT = 1;
const CASHFREE_API_VERSION = "2025-01-01";

export type CashfreeSubscriptionResponse = {
  subscription_id: string;
  cf_subscription_id?: string;
  subscription_session_id: string;
  subscription_status?: string;
};

function getCashfreeBaseUrl() {
  return getCashfreeMode() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

async function cashfreeSubscriptionRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const appId = getCashfreeAppId();
  const secretKey = getCashfreeSecretKey();

  if (!appId || !secretKey) {
    throw new Error("Cashfree credentials are not configured.");
  }

  const response = await fetch(`${getCashfreeBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-version": CASHFREE_API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secretKey,
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.message ?? `Cashfree subscription API failed (${response.status}).`,
    );
  }

  return payload;
}

export function buildCashfreeSubscriptionId(clinicId: string) {
  const suffix = Date.now().toString(36);
  return `ski_${clinicId.replace(/-/g, "").slice(0, 12)}_${suffix}`;
}

export async function createCashfreeSubscription(input: {
  clinicId: string;
  email: string;
  phone?: string | null;
  doctorName: string;
  clinicName: string;
  skipTrial?: boolean;
}) {
  const subscriptionId = buildCashfreeSubscriptionId(input.clinicId);
  const appUrl = getPublicAppUrl();
  const firstChargeTime = input.skipTrial
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : firstChargeTimeFromNow(TRIAL_DAYS);

  const body = {
    subscription_id: subscriptionId,
    customer_details: {
      customer_name: input.doctorName || input.clinicName,
      customer_email: input.email,
      customer_phone: normalizePhone(input.phone ?? "") || "9999999999",
    },
    plan_details: {
      plan_name: "Skiplines Clinic Monthly",
      plan_type: "PERIODIC",
      plan_amount: SKIPLINES_PLAN_AMOUNT,
      plan_max_amount: SKIPLINES_PLAN_AMOUNT,
      plan_currency: "INR",
      plan_intervals: 1,
      plan_interval_type: "MONTH",
      plan_note: "Skiplines OPD queue management — ₹999/month",
    },
    authorization_details: {
      authorization_amount: SKIPLINES_AUTH_AMOUNT,
      authorization_amount_refund: false,
      payment_methods: ["upi"],
    },
    subscription_meta: {
      return_url: `${appUrl}/dashboard?clinic=${input.clinicId}&subscription=success&subscription_id=${subscriptionId}`,
      notification_channel: ["EMAIL"],
    },
    subscription_expiry_time: new Date(
      Date.now() + 5 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    subscription_first_charge_time: firstChargeTime,
    subscription_tags: {
      clinic_id: input.clinicId,
      product: "skiplines_subscription",
    },
  };

  const response = await cashfreeSubscriptionRequest<CashfreeSubscriptionResponse>(
    "/subscriptions",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!response.subscription_session_id) {
    throw new Error("Cashfree did not return a subscription session ID.");
  }

  return response;
}

export async function fetchCashfreeSubscription(subscriptionId: string) {
  return cashfreeSubscriptionRequest<Record<string, unknown>>(
    `/subscriptions/${subscriptionId}`,
    { method: "GET" },
  );
}

export async function cancelCashfreeSubscription(subscriptionId: string) {
  return cashfreeSubscriptionRequest<Record<string, unknown>>(
    `/subscriptions/${subscriptionId}/manage`,
    {
      method: "POST",
      body: JSON.stringify({ action: "CANCEL" }),
    },
  );
}

export { normalizePhone as normalizeCustomerPhone };
