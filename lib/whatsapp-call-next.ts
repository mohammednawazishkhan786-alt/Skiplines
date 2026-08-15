const POSTGRES_UNIQUE_VIOLATION = "23505";

export const CALL_NEXT_NOTIFICATION_TYPE = "called";
export const CALL_NEXT_PENDING_MESSAGE = "call-next:pending";

export type CallNextNotifyParams = {
  clinicId: string;
  tokenId: string;
  patientPhone: string;
  tokenNumber: number;
};

export type CallNextTemplateBodyParam = "token" | "tracker";

export type WhatsAppSendResult =
  | { success: true; messageId?: string }
  | {
      success: false;
      httpStatus: number;
      errorCode?: number;
      errorType?: string;
      errorMessage?: string;
      fbtraceId?: string;
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

/**
 * Configures which approved template body variables to send.
 * Examples: "token" (default), "token,tracker", "none"
 */
export function getWhatsAppCallNextTemplateBodyParams(): CallNextTemplateBodyParam[] {
  const raw = (readEnv("WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS") ?? "token")
    .toLowerCase()
    .trim();

  if (!raw || raw === "none" || raw === "0") {
    return [];
  }

  const allowed = new Set<CallNextTemplateBodyParam>(["token", "tracker"]);
  const params: CallNextTemplateBodyParam[] = [];

  for (const part of raw.split(",")) {
    const key = part.trim() as CallNextTemplateBodyParam;
    if (allowed.has(key) && !params.includes(key)) {
      params.push(key);
    }
  }

  return params;
}

function hasWhatsAppCredentials(): boolean {
  return Boolean(getWhatsAppToken() && getWhatsAppPhoneNumberId());
}

function isUniqueViolationError(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === POSTGRES_UNIQUE_VIOLATION;
}

const CANONICAL_PRODUCTION_SITE_URL = "https://www.skiplines.in";

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

/** Must stay aligned with {@link formatWhatsAppDialNumber} in lib/whatsapp.ts */
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

/** Redact secrets, bearer tokens, and phone numbers from diagnostic text. */
export function sanitizeMetaDiagnostic(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\b91\d{10}\b/g, "[PHONE]")
    .replace(/\b\d{10}\b/g, "[PHONE]")
    .replace(/EAA[A-Za-z0-9]+/g, "[TOKEN]")
    .slice(0, 500);
}

export function parseMetaErrorResponse(
  httpStatus: number,
  body: string,
): Extract<WhatsAppSendResult, { success: false }> {
  let errorCode: number | undefined;
  let errorType: string | undefined;
  let errorMessage: string | undefined;
  let fbtraceId: string | undefined;

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: number;
        type?: string;
        message?: string;
        error_subcode?: number;
        fbtrace_id?: string;
      };
    };

    errorCode = parsed.error?.code;
    errorType = parsed.error?.type;
    errorMessage = parsed.error?.message;
    fbtraceId = parsed.error?.fbtrace_id;
  } catch {
    errorMessage = sanitizeMetaDiagnostic(body);
  }

  return {
    success: false,
    httpStatus,
    errorCode,
    errorType,
    errorMessage: errorMessage
      ? sanitizeMetaDiagnostic(errorMessage)
      : undefined,
    fbtraceId,
  };
}

export function formatMetaErrorForLog(
  result: Extract<WhatsAppSendResult, { success: false }>,
): string {
  const parts = [`status=${result.httpStatus}`];
  if (result.errorCode !== undefined) parts.push(`code=${result.errorCode}`);
  if (result.errorType) parts.push(`type=${result.errorType}`);
  if (result.errorMessage) parts.push(`msg=${result.errorMessage}`);
  if (result.fbtraceId) parts.push(`fbtrace=${result.fbtraceId}`);
  return parts.join(" ");
}

/** Dev/non-template fallback body — production uses an approved Meta template. */
export function buildCallNextTextBody(tokenNumber: number): string {
  return `🔔 Skiplines
Aapki baari aa gayi hai.
Kripya doctor ke paas jaiye.
Token: #${tokenNumber}`;
}

export function buildCallNextTemplatePayload(params: {
  to: string;
  templateName: string;
  languageCode: string;
  tokenNumber: number;
  liveTrackerUrl?: string;
  bodyParams?: CallNextTemplateBodyParam[];
}) {
  const bodyParams = params.bodyParams ?? getWhatsAppCallNextTemplateBodyParams();
  const parameters: Array<{ type: "text"; text: string }> = [];

  for (const key of bodyParams) {
    if (key === "token") {
      parameters.push({ type: "text", text: String(params.tokenNumber) });
    } else if (key === "tracker" && params.liveTrackerUrl) {
      parameters.push({ type: "text", text: params.liveTrackerUrl });
    }
  }

  const template: Record<string, unknown> = {
    name: params.templateName,
    language: { code: params.languageCode },
  };

  if (parameters.length > 0) {
    template.components = [{ type: "body", parameters }];
  }

  return {
    messaging_product: "whatsapp",
    to: formatWhatsAppDialNumber(params.to),
    type: "template",
    template,
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

export async function postWhatsAppTemplateMessage(
  payload: Record<string, unknown>,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = getWhatsAppPhoneNumberId();
  const token = getWhatsAppToken();

  if (!phoneNumberId || !token) {
    return {
      success: false,
      httpStatus: 0,
      errorType: "config",
      errorMessage: "WhatsApp credentials missing",
    };
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

  const body = await response.text();

  if (!response.ok) {
    const error = parseMetaErrorResponse(response.status, body);
    console.error(
      `[WhatsApp] call-next send failed ${formatMetaErrorForLog(error)}`,
    );
    return error;
  }

  try {
    const parsed = JSON.parse(body) as {
      messages?: Array<{ id?: string }>;
    };
    const messageId = parsed.messages?.[0]?.id;
    if (!messageId) {
      const error: Extract<WhatsAppSendResult, { success: false }> = {
        success: false,
        httpStatus: response.status,
        errorType: "invalid_response",
        errorMessage: "Meta response missing messages[0].id",
      };
      console.error(
        `[WhatsApp] call-next send failed ${formatMetaErrorForLog(error)}`,
      );
      return error;
    }

    return { success: true, messageId };
  } catch {
    const error: Extract<WhatsAppSendResult, { success: false }> = {
      success: false,
      httpStatus: response.status,
      errorType: "invalid_response",
      errorMessage: "Meta response was not valid JSON",
    };
    console.error(
      `[WhatsApp] call-next send failed ${formatMetaErrorForLog(error)}`,
    );
    return error;
  }
}

function buildFailureLogMessage(
  baseMessage: string,
  result: Extract<WhatsAppSendResult, { success: false }>,
): string {
  return `${baseMessage} (delivery failed: ${formatMetaErrorForLog(result)})`;
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
      console.warn(
        `[WhatsApp] call-next skipped (missing phone) token=${tokenId}`,
      );
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
      const paramCount =
        (payload.template as { components?: Array<{ parameters?: unknown[] }> })
          .components?.[0]?.parameters?.length ?? 0;
      logMessage = `template:${templateName} lang=${getWhatsAppCallNextTemplateLanguage()} params=${paramCount} token=#${tokenNumber}`;
    } else if (!isProductionRuntime()) {
      const dialTo = formatWhatsAppDialNumber(patientPhone);
      if (!dialTo) {
        console.warn(
          `[WhatsApp] call-next skipped (invalid phone) token=${tokenId}`,
        );
        return false;
      }

      const body = buildCallNextTextBody(tokenNumber);
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

    const result = await postWhatsAppTemplateMessage(outboundPayload);

    if (result.success) {
      const successMessage = result.messageId
        ? `${logMessage} wamid=${result.messageId}`
        : logMessage;
      await finalizeCallNextNotification({
        tokenId,
        message: successMessage,
        status: "sent",
      });
      return true;
    }

    await finalizeCallNextNotification({
      tokenId,
      message: buildFailureLogMessage(logMessage, result),
      status: "failed",
    });

    return false;
  } catch (error) {
    const detail =
      error instanceof Error
        ? sanitizeMetaDiagnostic(error.message)
        : "unknown";
    console.error(`[WhatsApp] call-next failed token=${tokenId}: ${detail}`);
    return false;
  }
}
