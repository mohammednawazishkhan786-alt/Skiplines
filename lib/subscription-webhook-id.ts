import { createHash } from "node:crypto";

/** Stable id for subscription webhook idempotency (retries share the same raw body). */
export function buildSubscriptionWebhookEventId(
  eventType: string,
  rawBody: string,
  explicitEventId?: string | null,
) {
  const trimmed = explicitEventId?.trim();
  if (trimmed) {
    return trimmed;
  }

  const bodyHash = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
  return `${eventType}:${bodyHash}`;
}
