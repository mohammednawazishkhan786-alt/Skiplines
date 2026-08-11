import { load } from "@cashfreepayments/cashfree-js";
import type { CashfreeMode } from "@/lib/env";
import { getPublicCashfreeMode } from "@/lib/env";
import { sanitizeCashfreeErrorMessage } from "@/lib/cashfree-navigation";

export async function openCashfreeCheckout(
  paymentSessionId: string,
  returnUrl: string,
  mode: CashfreeMode,
) {
  if (mode !== "production") {
    throw new Error("Live payments require Cashfree production mode.");
  }

  const sessionId = paymentSessionId.trim();

  if (!sessionId) {
    throw new Error("Payment session was missing. Please try again.");
  }

  const cashfree = await load({
    mode: "production",
  });

  if (!cashfree) {
    throw new Error("Cashfree checkout could not be loaded.");
  }

  const result = await cashfree.checkout({
    paymentSessionId: sessionId,
    returnUrl,
    redirectTarget: "_modal",
  });

  if (result.error) {
    throw new Error(sanitizeCashfreeErrorMessage(result.error.message));
  }

  return result;
}

export async function openCashfreeSubscriptionCheckout(
  subscriptionSessionId: string,
) {
  const cashfree = await load({
    mode: getPublicCashfreeMode(),
  });

  if (!cashfree) {
    throw new Error("Cashfree checkout could not be loaded.");
  }

  const result = await cashfree.subscriptionsCheckout({
    subsSessionId: subscriptionSessionId,
    redirectTarget: "_modal",
  });

  if (result.error) {
    throw new Error(sanitizeCashfreeErrorMessage(result.error.message));
  }

  return result;
}
