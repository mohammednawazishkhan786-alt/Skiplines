import {
  getWhatsAppOtpTemplateLanguage,
  getWhatsAppOtpTemplateName,
  getWhatsAppPhoneNumberId,
  getWhatsAppToken,
  hasWhatsAppCredentials,
} from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { formatWhatsAppDialNumber } from "@/lib/whatsapp";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const VERIFICATION_SESSION_MS = 5 * 60 * 1000;

export function isDevOtpBypassEnabled() {
  return process.env.OTP_DEV_BYPASS === "true";
}

export async function sendWhatsAppOtp(phone: string, otp: string) {
  if (!hasWhatsAppCredentials()) {
    if (isDevOtpBypassEnabled()) {
      return { channel: "dev" as const };
    }

    throw new Error(
      "WhatsApp Business API is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    );
  }

  const phoneNumberId = getWhatsAppPhoneNumberId();
  const token = getWhatsAppToken();

  if (!phoneNumberId || !token || phoneNumberId.startsWith("your_")) {
    throw new Error("WhatsApp Business API credentials are invalid.");
  }

  const to = formatWhatsAppDialNumber(phone);
  const templateName = getWhatsAppOtpTemplateName();

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        templateName
          ? {
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: {
                name: templateName,
                language: { code: getWhatsAppOtpTemplateLanguage() },
                components: [
                  {
                    type: "body",
                    parameters: [{ type: "text", text: otp }],
                  },
                ],
              },
            }
          : {
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: {
                body: `Your Skiplines verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
              },
            },
      ),
    },
  );

  if (!response.ok) {
    let detail = "WhatsApp OTP delivery failed.";
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (payload.error?.message) {
        detail = payload.error.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  return { channel: "whatsapp" as const };
}
