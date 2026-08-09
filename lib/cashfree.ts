import { Cashfree, CFEnvironment, type CreateOrderRequest } from "cashfree-pg";
import {
  getCashfreeAppId,
  getCashfreeMode,
  getCashfreeSecretKey,
  getPublicAppUrl,
} from "@/lib/env";
import { normalizePhone } from "@/lib/phone";

export const SKIPLINES_SUBSCRIPTION_AMOUNT = 999;

export function getCashfreeClient() {
  const appId = getCashfreeAppId();
  const secretKey = getCashfreeSecretKey();

  if (!appId || !secretKey) {
    throw new Error("Cashfree credentials are not configured.");
  }

  const environment =
    getCashfreeMode() === "production"
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  return new Cashfree(environment, appId, secretKey);
}

export function buildCashfreeOrderId(clinicId: string) {
  const suffix = Date.now().toString(36);
  return `ski_${clinicId.replace(/-/g, "").slice(0, 12)}_${suffix}`;
}

export function normalizeCustomerPhone(phone: string) {
  return normalizePhone(phone) || "9999999999";
}

export async function createSubscriptionOrder(input: {
  clinicId: string;
  email: string;
  phone: string;
  doctorName: string;
  clinicName: string;
}) {
  const cashfree = getCashfreeClient();
  const orderId = buildCashfreeOrderId(input.clinicId);
  const appUrl = getPublicAppUrl();
  const returnUrl = `${appUrl}/dashboard?clinic=${input.clinicId}&payment=success&order_id={order_id}`;
  const notifyUrl = `${appUrl}/api/webhooks/cashfree`;

  const request: CreateOrderRequest = {
    order_id: orderId,
    order_amount: SKIPLINES_SUBSCRIPTION_AMOUNT,
    order_currency: "INR",
    order_note: "Skiplines clinic subscription — ₹999/month",
    customer_details: {
      customer_id: input.clinicId,
      customer_email: input.email,
      customer_phone: normalizeCustomerPhone(input.phone),
      customer_name: input.doctorName || input.clinicName,
    },
    order_meta: {
      return_url: returnUrl,
      notify_url: notifyUrl,
    },
    order_tags: {
      clinic_id: input.clinicId,
      product: "skiplines_subscription",
    },
  };

  const response = await cashfree.PGCreateOrder(request);
  const order = response.data;

  if (!order.payment_session_id) {
    throw new Error("Cashfree did not return a payment session ID.");
  }

  return {
    order_id: order.order_id ?? orderId,
    payment_session_id: order.payment_session_id,
    order_status: order.order_status,
    order_amount: order.order_amount,
  };
}

export async function fetchCashfreeOrder(orderId: string) {
  const cashfree = getCashfreeClient();
  const response = await cashfree.PGFetchOrder(orderId);
  return response.data;
}

export async function isCashfreeOrderPaid(orderId: string) {
  const cashfree = getCashfreeClient();
  const orderResponse = await cashfree.PGFetchOrder(orderId);
  const order = orderResponse.data;

  if (order.order_status === "PAID") {
    return true;
  }

  const paymentsResponse = await cashfree.PGOrderFetchPayments(orderId);
  return (paymentsResponse.data ?? []).some(
    (payment) => payment.payment_status === "SUCCESS",
  );
}

export function verifyCashfreeWebhook(
  signature: string | null,
  rawBody: string,
  timestamp: string | null,
) {
  if (!signature || !timestamp) {
    throw new Error("Missing Cashfree webhook signature headers.");
  }

  const cashfree = getCashfreeClient();
  return cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
}
