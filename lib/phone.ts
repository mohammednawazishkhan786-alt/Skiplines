/**
 * Indian mobile phone normalization and validation.
 * Stores and compares the 10-digit national number (no country prefix).
 */

const INVALID_START_DIGITS = new Set(["0", "1", "2", "3", "4", "5"]);

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function isValidIndianMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  if (!/^\d{10}$/.test(normalized)) {
    return false;
  }
  // Indian mobile numbers start with 6–9.
  if (INVALID_START_DIGITS.has(normalized[0])) {
    return false;
  }
  return true;
}

export function formatIndianMobileDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!isValidIndianMobile(normalized)) {
    return phone.trim();
  }
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

export const INVALID_PHONE_MESSAGE =
  "Enter a valid 10-digit Indian WhatsApp / mobile number.";
