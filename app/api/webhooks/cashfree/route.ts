import { handleCashfreeWebhook } from "@/lib/cashfree-webhook-handler";
import { withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/webhooks/cashfree",
  handleCashfreeWebhook,
);
