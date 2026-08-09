import { load } from "@cashfreepayments/cashfree-js";
import { getPublicCashfreeMode } from "@/lib/env";

export async function openCashfreeCheckout(
  paymentSessionId: string,
  returnUrl: string,
) {
  const cashfree = await load({
    mode: getPublicCashfreeMode(),
  });

  if (!cashfree) {
    throw new Error("Cashfree checkout could not be loaded.");
  }

  const result = await cashfree.checkout({
    paymentSessionId,
    returnUrl,
    redirectTarget: "_self",
  });

  if (result.error) {
    throw new Error(result.error.message);
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
    throw new Error(result.error.message);
  }

  return result;
}
