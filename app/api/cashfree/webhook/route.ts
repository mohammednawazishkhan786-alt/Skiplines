import { NextResponse } from "next/server";
import { handleCashfreeWebhook } from "@/lib/cashfree-webhook-handler";
import { withSentryApiRoute } from "@/lib/sentry-api";

export const POST = withSentryApiRoute(
  "POST",
  "/api/cashfree/webhook",
  handleCashfreeWebhook,
);
