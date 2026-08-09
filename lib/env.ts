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
