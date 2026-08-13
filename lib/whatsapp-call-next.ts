const CANONICAL_PRODUCTION_SITE_URL = "https://www.skiplines.in";
const POSTGRES_UNIQUE_VIOLATION = "23505";

export const CALL_NEXT_NOTIFICATION_TYPE = "called";
export const CALL_NEXT_PENDING_MESSAGE = "call-next:pending";

export type CallNextNotifyParams = {
  clinicId: string;
  tokenId: string;
  patientPhone: string;
  tokenNumber: number;
};

type ClaimResult = "claimed" | "duplicate" | "unavailable";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your_")) return undefined;
  return value;
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function normalizeSiteUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isDisallowedPublicHost(url: string) {
  return /localhost|127\.0\.0\.1|vercel\.app/i.test(url);
}

function getPublicAppUrl(): string {
  const configured =
    readEnv("NEXT_PUBLIC_APP_URL") ?? readEnv("NEXT_PUBLIC_SITE_URL");

  if (isProductionRuntime()) {
    if (configured && !isDisallowedPublicHost(configured)) {
      return normalizeSiteUrl(configured);
    }
    return CANONICAL_PRODUCTION_SITE_URL;
  }

  if (configured) {
    return normalizeSiteUrl(configured);
  }

  return "http://localhost:3000";
}

function getWhatsAppToken(): string | undefined {
  return readEnv("WHATSAPP_TOKEN") ?? readEnv("WHATSAPP_ACCESS_TOKEN");
}

function getWhatsAppPhoneNumberId(): string | undefined {
  return readEnv("WHATSAPP_PHONE_NUMBER_ID");
}

function getWhatsAppCallNextTemplate(): string | undefined {
  return readEnv("WHATSAPP_CALL_NEXT_TEMPLATE");
}

function getWhatsAppCallNextTemplateLanguage(): string {
  return readEnv("WHATSAPP_CALL_NEXT_TEMPLATE_LANGUAGE") ?? "en";
}

function hasWhatsAppCredentials(): boolean {
  return Boolean(getWhatsAppToken() && getWhatsAppPhoneNumberId());
}

function isUniqueViolationError(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === POSTGRES_UNIQUE_VIOLATION;
}

function formatWhatsAppDialNumber(phone: string): string {
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

export function buildCallNextTextBody(
  tokenNumber: number,
  liveTrackerUrl: string,
): string {
  return `🔔 It's your turn! Token #${tokenNumber} — the doctor is ready. Please proceed now. Live tracker: ${liveTrackerUrl}`;
}

export function buildCallNextTemplatePayload(params: {
  to: string;
  templateName: string;
  languageCode: string;
  tokenNumber: number;
  liveTrackerUrl: string;
}) {
  return {
    messaging_product: "whatsapp",
    to: formatWhatsAppDialNumber(params.to),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: String(params.tokenNumber) },
            { type: "text", text: params.liveTrackerUrl },
          ],
        },
      ],
    },
  };
}

async function claimCallNextNotificationSlot(params: {
  clinicId: string;
  tokenId: string;
  patientPhone: string;
}): Promise<ClaimResult> {
  try {
    const { createAdminClient } = await import("./supabase/admin");
    const supabase = createAdminClient();
    const { error } = await supabase.from("notification_logs").insert({
      clinic_id: params.clinicId,
      token_id: params.tokenId,
      phone: params.patientPhone,
      type: CALL_NEXT_NOTIFICATION_TYPE,
      message: CALL_NEXT_PENDING_MESSAGE,
      status: "pending",
    });

    if (error) {
      if (isUniqueViolationError(error)) {
        return "duplicate";
      }
      return "unavailable";
    }

    return "claimed";
  } catch {
    return "unavailable";
  }
}

async function finalizeCallNextNotification(params: {
  tokenId: string;
  message: string;
  status: "sent" | "failed";
}): Promise<void> {
  try {
    const { createAdminClient } = await import("./supabase/admin");
    const supabase = createAdminClient();
    await supabase
      .from("notification_logs")
      .update({ message: params.message, status: params.status })
      .eq("token_id", params.tokenId)
      .eq("type", CALL_NEXT_NOTIFICATION_TYPE);
  } catch {
    // Non-blocking
  }
}

async function postWhatsAppMessage(payload: Record<string, unknown>): Promise<boolean> {
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const token = getWhatsAppToken();

  if (!phoneNumberId || !token) {
    return false;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    console.error(
      `[WhatsApp] call-next send failed status=${response.status}`,
    );
    return false;
  }

  return true;
}

/**
 * Sends a Call Next WhatsApp notification for the patient token that was just called.
 * Never throws — queue state must not depend on WhatsApp delivery.
 */
export async function notifyCallNextPatient(
  params: CallNextNotifyParams,
): Promise<boolean> {
  const { clinicId, tokenId, patientPhone, tokenNumber } = params;

  try {
    if (!patientPhone.trim()) {
      return false;
    }

    if (!hasWhatsAppCredentials()) {
      console.warn(
        `[WhatsApp] call-next skipped (credentials missing) token=${tokenId}`,
      );
      return false;
    }

    const liveTrackerUrl = `${getPublicAppUrl()}/live/${tokenId}`;
    const templateName = getWhatsAppCallNextTemplate();
    let outboundPayload: Record<string, unknown> | null = null;
    let logMessage = "";

    if (templateName) {
      const payload = buildCallNextTemplatePayload({
        to: patientPhone,
        templateName,
        languageCode: getWhatsAppCallNextTemplateLanguage(),
        tokenNumber,
        liveTrackerUrl,
      });

      if (!payload.to) {
        console.warn(
          `[WhatsApp] call-next skipped (invalid phone) token=${tokenId}`,
        );
        return false;
      }

      outboundPayload = payload;
      logMessage = `template:${templateName} token=#${tokenNumber}`;
    } else if (!isProductionRuntime()) {
      const dialTo = formatWhatsAppDialNumber(patientPhone);
      if (!dialTo) {
        console.warn(
          `[WhatsApp] call-next skipped (invalid phone) token=${tokenId}`,
        );
        return false;
      }

      const body = buildCallNextTextBody(tokenNumber, liveTrackerUrl);
      outboundPayload = {
        messaging_product: "whatsapp",
        to: dialTo,
        type: "text",
        text: { body },
      };
      logMessage = body;
    } else {
      console.warn(
        `[WhatsApp] call-next skipped (template not configured) token=${tokenId}`,
      );
      return false;
    }

    const claim = await claimCallNextNotificationSlot({
      clinicId,
      tokenId,
      patientPhone,
    });

    if (claim === "duplicate") {
      console.info(`[WhatsApp] call-next skipped (already sent) token=${tokenId}`);
      return true;
    }

    if (claim === "unavailable") {
      console.warn(
        `[WhatsApp] call-next skipped (notification claim unavailable) token=${tokenId}`,
      );
      return false;
    }

    const success = await postWhatsAppMessage(outboundPayload);

    await finalizeCallNextNotification({
      tokenId,
      message: success ? logMessage : `${logMessage} (delivery failed)`,
      status: success ? "sent" : "failed",
    });

    return success;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    console.error(`[WhatsApp] call-next failed token=${tokenId}: ${detail}`);
    return false;
  }
}
