import type { Clinic } from "@/lib/types";

export const DUPLICATE_PHONE_MESSAGE =
  "This mobile number has already used a 7-day free trial.";

/** @deprecated Use DUPLICATE_PHONE_MESSAGE */
export const TRIAL_ABUSE_MESSAGE = DUPLICATE_PHONE_MESSAGE;

export const TRIAL_DAYS = 7;
export const SUBSCRIPTION_PERIOD_DAYS = 30;

export function normalizeSubscriptionStatus(status: string): string {
  return status.trim().toUpperCase();
}

export function isTrialActive(clinic: Pick<Clinic, "subscription_status" | "trial_ends_at">) {
  const status = normalizeSubscriptionStatus(clinic.subscription_status);
  if (status !== "ACTIVE_TRIAL" && status !== "TRIAL") {
    return false;
  }
  if (!clinic.trial_ends_at) {
    return false;
  }
  return new Date(clinic.trial_ends_at) > new Date();
}

export function isPaidSubscriptionActive(
  clinic: Pick<Clinic, "subscription_status" | "subscription_expires_at">,
) {
  const status = normalizeSubscriptionStatus(clinic.subscription_status);
  if (status !== "ACTIVE") {
    return false;
  }
  if (!clinic.subscription_expires_at) {
    return true;
  }
  return new Date(clinic.subscription_expires_at) > new Date();
}

export function hasDashboardAccess(
  clinic: Pick<
    Clinic,
    "subscription_status" | "trial_ends_at" | "subscription_expires_at"
  >,
) {
  const status = normalizeSubscriptionStatus(clinic.subscription_status);

  if (status === "EXPIRED" || status === "PENDING_MANDATE") {
    return false;
  }

  if (status === "ACTIVE_TRIAL" || status === "TRIAL") {
    return isTrialActive(clinic);
  }

  if (status === "ACTIVE") {
    return isPaidSubscriptionActive(clinic);
  }

  if (status === "PENDING_PAYMENT") {
    return false;
  }

  return false;
}

export function trialEndsAtFromNow(days = TRIAL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function extendSubscriptionExpiry(
  current: string | null | undefined,
  days = SUBSCRIPTION_PERIOD_DAYS,
) {
  const base =
    current && new Date(current) > new Date()
      ? new Date(current)
      : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

export function firstChargeTimeFromNow(days = TRIAL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
