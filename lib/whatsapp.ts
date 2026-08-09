import {
  getWhatsAppPhoneNumberId,
  getWhatsAppToken,
} from "@/lib/env";

export function getWhatsAppBusinessNumber(): string {
  return (
    process.env.WHATSAPP_BUSINESS_NUMBER ??
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ??
    ""
  ).replace(/\D/g, "");
}

export function buildWhatsAppTokenUrl(clinicId: string): string {
  const number = getWhatsAppBusinessNumber();
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

  const normalizedTo = to.replace(/\D/g, "");

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
