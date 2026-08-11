import { getPublicAppUrl } from "@/lib/env";

export const STRIP_PAYMENT_QUERY_KEYS = [
  "payment_session_id",
  "payment_session",
  "session_id",
] as const;

export const PAYMENT_RETURN_QUERY_KEYS = [
  "order_id",
  "payment",
  "payment_error",
  ...STRIP_PAYMENT_QUERY_KEYS,
] as const;

export function cleanDashboardPath(clinicId?: string | null) {
  return clinicId ? `/dashboard?clinic=${clinicId}` : "/dashboard";
}

export function cleanDashboardUrl(clinicId?: string | null) {
  return `${getPublicAppUrl()}${cleanDashboardPath(clinicId)}`;
}

export function hasPaymentReturnParams(searchParams: URLSearchParams) {
  return PAYMENT_RETURN_QUERY_KEYS.some((key) =>
    Boolean(searchParams.get(key)?.trim()),
  );
}

export function sanitizeCashfreeErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("payment_session_id") ||
    normalized.includes("payment_session_id_invalid")
  ) {
    return "Payment session was invalid. Please try again from the dashboard.";
  }

  try {
    const parsed = JSON.parse(message) as {
      message?: string;
      code?: string;
    };

    if (
      parsed.code === "payment_session_id_invalid" ||
      parsed.message?.toLowerCase().includes("payment_session_id")
    ) {
      return "Payment session was invalid. Please try again from the dashboard.";
    }

    if (parsed.message) {
      return sanitizeCashfreeErrorMessage(parsed.message);
    }
  } catch {
    // Not JSON — use the original message.
  }

  return message;
}
