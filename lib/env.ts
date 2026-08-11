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

export function getWhatsAppAppSecret(): string | undefined {
  return readEnv("WHATSAPP_APP_SECRET");
}

export function hasWhatsAppCredentials(): boolean {
  return Boolean(getWhatsAppToken() && getWhatsAppPhoneNumberId());
}

export function hasOpenAICredentials(): boolean {
  return Boolean(getOpenAIApiKey());
}

export function getResendApiKey(): string | undefined {
  return readEnv("RESEND_API_KEY");
}

export function getResendFromEmail(): string | undefined {
  return readEnv("RESEND_FROM_EMAIL");
}

export function getCashfreeAppId(): string | undefined {
  return readEnv("NEXT_PUBLIC_CASHFREE_APP_ID");
}

export function getCashfreeSecretKey(): string | undefined {
  return readEnv("CASHFREE_SECRET_KEY");
}

export type CashfreeMode = "production" | "sandbox";

const PRODUCTION_MODE: CashfreeMode = "production";

export function getCashfreeMode(): CashfreeMode {
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_MODE;
  }

  const mode = readEnv("CASHFREE_MODE")?.toLowerCase();
  return mode === "production" ? PRODUCTION_MODE : "sandbox";
}

/** Client bundle mode — must match {@link getCashfreeMode} on production. */
export function getPublicCashfreeMode(): CashfreeMode {
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_MODE;
  }

  const mode = readEnv("NEXT_PUBLIC_CASHFREE_MODE")?.toLowerCase();
  return mode === "production" ? PRODUCTION_MODE : "sandbox";
}

/** Server-authoritative mode for checkout (always from CASHFREE_MODE). */
export function getCashfreeCheckoutMode(): CashfreeMode {
  return getCashfreeMode();
}

export function getCashfreeModeMismatch():
  | { consistent: true; mode: CashfreeMode }
  | {
      consistent: false;
      serverMode: CashfreeMode;
      clientMode: CashfreeMode;
    } {
  const serverMode = getCashfreeMode();
  const clientMode = getPublicCashfreeMode();

  if (serverMode === clientMode) {
    return { consistent: true, mode: serverMode };
  }

  return { consistent: false, serverMode, clientMode };
}

/** Returns an error message when live Cashfree is misconfigured. */
export function assertLiveCashfreeEnvironment(): string | null {
  if (!hasCashfreeCredentials()) {
    return "Cashfree credentials are not configured.";
  }

  if (getCashfreeMode() !== PRODUCTION_MODE) {
    return "Cashfree must run in production mode.";
  }

  if (getPublicCashfreeMode() !== PRODUCTION_MODE) {
    return "NEXT_PUBLIC_CASHFREE_MODE must be production.";
  }

  const mismatch = getCashfreeModeMismatch();
  if (!mismatch.consistent) {
    return "CASHFREE_MODE and NEXT_PUBLIC_CASHFREE_MODE must both be production.";
  }

  return null;
}

export const CANONICAL_PRODUCTION_SITE_URL = "https://www.skiplines.in";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isDisallowedPublicHost(url: string) {
  return /localhost|127\.0\.0\.1|vercel\.app/i.test(url);
}

/**
 * Single source of truth for public-facing Skiplines URLs (QR, clinic links,
 * share links, redirects, Cashfree return URLs, WhatsApp links).
 */
export function getCanonicalSiteUrl(): string {
  const configured =
    readEnv("NEXT_PUBLIC_APP_URL") ?? readEnv("NEXT_PUBLIC_SITE_URL");

  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  if (isProduction) {
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

export function getPublicAppUrl(): string {
  return getCanonicalSiteUrl();
}

export function hasCashfreeCredentials(): boolean {
  return Boolean(getCashfreeAppId() && getCashfreeSecretKey());
}
