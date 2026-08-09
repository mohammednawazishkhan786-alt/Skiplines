function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your_")) return undefined;
  return value;
}

export function getOpenAIApiKey(): string | undefined {
  return readEnv("OPENAI_API_KEY");
}

export function getWhatsAppToken(): string | undefined {
  return readEnv("WHATSAPP_TOKEN") ?? readEnv("WHATSAPP_ACCESS_TOKEN");
}

export function getWhatsAppPhoneNumberId(): string | undefined {
  return readEnv("WHATSAPP_PHONE_NUMBER_ID");
}

export function getWhatsAppVerifyToken(): string | undefined {
  return readEnv("WHATSAPP_VERIFY_TOKEN");
}

export function hasWhatsAppCredentials(): boolean {
  return Boolean(getWhatsAppToken() && getWhatsAppPhoneNumberId());
}

export function hasOpenAICredentials(): boolean {
  return Boolean(getOpenAIApiKey());
}

export function getCashfreeAppId(): string | undefined {
  return readEnv("NEXT_PUBLIC_CASHFREE_APP_ID");
}

export function getCashfreeSecretKey(): string | undefined {
  return readEnv("CASHFREE_SECRET_KEY");
}

export function getCashfreeMode(): "sandbox" | "production" {
  const mode = readEnv("CASHFREE_MODE")?.toLowerCase();
  return mode === "production" ? "production" : "sandbox";
}

export function getPublicCashfreeMode(): "sandbox" | "production" {
  const mode = readEnv("NEXT_PUBLIC_CASHFREE_MODE")?.toLowerCase();
  return mode === "production" ? "production" : "sandbox";
}

export function getPublicAppUrl(): string {
  return readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

export function hasCashfreeCredentials(): boolean {
  return Boolean(getCashfreeAppId() && getCashfreeSecretKey());
}

export function getWhatsAppOtpTemplateName(): string | undefined {
  return readEnv("WHATSAPP_OTP_TEMPLATE_NAME");
}

export function getWhatsAppOtpTemplateLanguage(): string {
  return readEnv("WHATSAPP_OTP_TEMPLATE_LANGUAGE") ?? "en";
}
