declare module "@cashfreepayments/cashfree-js" {
  type CashfreeMode = "sandbox" | "production";

  type LoadOptions = {
    mode: CashfreeMode;
  };

  type CheckoutOptions = {
    paymentSessionId: string;
    returnUrl?: string;
    redirectTarget?: "_self" | "_blank" | "_modal";
  };

  type CheckoutResult = {
    error?: { message: string };
    redirect?: boolean;
    paymentDetails?: { paymentMessage?: string };
  };

  type CashfreeInstance = {
    checkout: (options: CheckoutOptions) => Promise<CheckoutResult>;
    subscriptionsCheckout: (options: {
      subsSessionId: string;
      redirectTarget?: "_self" | "_blank" | "_modal";
    }) => Promise<CheckoutResult>;
  };

  export function load(options: LoadOptions): Promise<CashfreeInstance | null>;
}
