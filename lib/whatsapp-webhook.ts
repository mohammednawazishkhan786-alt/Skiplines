import { createHmac, timingSafeEqual } from "node:crypto";
import { getWhatsAppAppSecret } from "@/lib/env";

export function verifyWhatsAppWebhookSignature(
  signatureHeader: string | null,
  rawBody: string,
) {
  const secret = getWhatsAppAppSecret();

  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const received = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (received.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(received, expectedBuffer);
}
