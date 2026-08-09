import {
  getWhatsAppPhoneNumberId,
  getWhatsAppToken,
  hasWhatsAppCredentials,
} from "@/lib/env";
import { normalizePhone } from "@/lib/phone";

const PLACEHOLDER_NUMBERS = new Set([
  "9876543210",
  "919876543210",
  "9999999999",
]);

export function formatWhatsAppDialNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

export function getWhatsAppBusinessNumber(): string {
  const fromEnv = (
    process.env.WHATSAPP_BUSINESS_NUMBER ??
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ??
    ""
  ).replace(/\D/g, "");

  if (fromEnv && !PLACEHOLDER_NUMBERS.has(fromEnv)) {
    return fromEnv;
  }

  return "";
}

export function buildWhatsAppTokenUrl(
  clinicId: string,
  clinicPhone?: string | null,
): string {
  const number =
    formatWhatsAppDialNumber(clinicPhone ?? "") || getWhatsAppBusinessNumber();

  if (!number || PLACEHOLDER_NUMBERS.has(number.slice(-10))) {
    throw new Error(
      "Clinic WhatsApp number is missing. Please update your registered phone number.",
    );
  }

  const message = encodeURIComponent(`TOKEN ${clinicId}`);
  return `https://wa.me/${number}?text=${message}`;
}

export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<boolean> {
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const token = getWhatsAppToken();

  if (!phoneNumberId || !token) {
    console.warn("WhatsApp credentials missing — message not sent:", body);
    return false;
  }

  const normalizedTo = formatWhatsAppDialNumber(to);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "text",
        text: { body },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("WhatsApp send failed:", error);
    return false;
  }

  return true;
}

export async function logNotification(
  clinicId: string,
  tokenId: string | null,
  phone: string,
  type: string,
  message: string,
) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("notification_logs").insert({
      clinic_id: clinicId,
      token_id: tokenId,
      phone,
      type,
      message,
    });
  } catch {
    // Non-blocking
  }
}

export { hasWhatsAppCredentials };
