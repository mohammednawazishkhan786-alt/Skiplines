import type { Clinic } from "./types";

/**
 * Runtime subscription configuration.
 * Production defaults are unchanged unless SUBSCRIPTION_TEST_MODE=true.
 * Test mode is ignored on production runtimes even if the env var is set.
 */

export const PRODUCTION_TRIAL_DAYS = 7;
export const PRODUCTION_SUBSCRIPTION_AMOUNT_INR = 999;
export const PRODUCTION_SUBSCRIPTION_PLAN = "monthly_999";

export const TEST_TRIAL_MS = 60_000;
export const TEST_SUBSCRIPTION_AMOUNT_INR = 1;
export const TEST_SUBSCRIPTION_PLAN = "test_1min";
export const TEST_PERIOD_MS = 60_000;

export function isSubscriptionTestMode(): boolean {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }

  return process.env.SUBSCRIPTION_TEST_MODE?.trim().toLowerCase() === "true";
}

export function getSubscriptionAmountInr(): number {
  return isSubscriptionTestMode()
    ? TEST_SUBSCRIPTION_AMOUNT_INR
    : PRODUCTION_SUBSCRIPTION_AMOUNT_INR;
}

export function getTrialDurationMs(): number {
  return isSubscriptionTestMode()
    ? TEST_TRIAL_MS
    : PRODUCTION_TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function getSubscriptionPeriodMs(): number | null {
  return isSubscriptionTestMode() ? TEST_PERIOD_MS : null;
}

export function getSubscriptionPlanId(): string {
  return isSubscriptionTestMode()
    ? TEST_SUBSCRIPTION_PLAN
    : PRODUCTION_SUBSCRIPTION_PLAN;
}

export function trialEndsAtFromConfigured(now = Date.now()): string {
  return new Date(now + getTrialDurationMs()).toISOString();
}

export function firstChargeTimeFromConfigured(now = Date.now()): string {
  return trialEndsAtFromConfigured(now);
}

export function subscriptionPaymentRequiredMessage(): string {
  const amount = getSubscriptionAmountInr();
  const period = isSubscriptionTestMode() ? "1 minute" : "1 month";
  return `Your free trial has ended. Pay ₹${amount} to unlock Skiplines for ${period}.`;
}

export function subscriptionPaymentFailedMessage(): string {
  const amount = getSubscriptionAmountInr();
  return `Your last payment failed. Pay ₹${amount} to reactivate Skiplines.`;
}

/** Production trial length in days (unchanged when test mode is off). */
export const TRIAL_DAYS = PRODUCTION_TRIAL_DAYS;
/** Production subscription amount in INR (unchanged when test mode is off). */
export const SUBSCRIPTION_AMOUNT_INR = PRODUCTION_SUBSCRIPTION_AMOUNT_INR;

export function normalizeSubscriptionStatus(status: string): string {
  return status.trim().toLowerCase();
}

export function isTrialActive(
  clinic: Pick<Clinic, "subscription_status" | "trial_ends_at">,
) {
  if (!clinic.trial_ends_at) {
    const status = normalizeSubscriptionStatus(clinic.subscription_status);
    return status === "trialing" || status === "trial";
  }
  return new Date(clinic.trial_ends_at) > new Date();
}

export function isPaidSubscriptionActive(
  clinic: Pick<Clinic, "subscription_status" | "subscription_expires_at">,
) {
  const status = normalizeSubscriptionStatus(clinic.subscription_status);
  if (status !== "active") {
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
  if (isPaidSubscriptionActive(clinic)) {
    return true;
  }

  return isTrialActive(clinic);
}

export function getTrialDaysRemaining(
  clinic: Pick<Clinic, "trial_ends_at">,
): number {
  if (!clinic.trial_ends_at) {
    return 0;
  }
  const msLeft = new Date(clinic.trial_ends_at).getTime() - Date.now();
  if (msLeft <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

export function trialEndsAtFromNow(days = TRIAL_DAYS) {
  if (isSubscriptionTestMode()) {
    return trialEndsAtFromConfigured();
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function getSubscriptionAccessError(
  clinic: Pick<
    Clinic,
    "subscription_status" | "trial_ends_at" | "subscription_expires_at"
  >,
) {
  if (hasDashboardAccess(clinic)) {
    return null;
  }

  const status = normalizeSubscriptionStatus(clinic.subscription_status);

  if (status === "pending_mandate" || status === "pending_payment") {
    return subscriptionPaymentRequiredMessage();
  }

  if (status === "payment_failed") {
    return subscriptionPaymentFailedMessage();
  }

  return subscriptionPaymentRequiredMessage();
}

export function firstChargeTimeFromNow(days = TRIAL_DAYS) {
  if (isSubscriptionTestMode()) {
    return firstChargeTimeFromConfigured();
  }
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export type ReconcileClinicRow = {
  id: string;
  subscription_status: string | null;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
};

export type ReconcileAction =
  | { type: "none" }
  | { type: "expire_trial"; clinicId: string }
  | { type: "expire_subscription"; clinicId: string };

function toAccessClinic(clinic: ReconcileClinicRow) {
  return {
    subscription_status: clinic.subscription_status ?? "",
    trial_ends_at: clinic.trial_ends_at,
    subscription_expires_at: clinic.subscription_expires_at,
  };
}

export function planSubscriptionReconciliation(
  clinic: ReconcileClinicRow,
): ReconcileAction {
  if (hasDashboardAccess(toAccessClinic(clinic))) {
    return { type: "none" };
  }

  const status = normalizeSubscriptionStatus(clinic.subscription_status ?? "");

  if (status === "trialing" || status === "trial") {
    return { type: "expire_trial", clinicId: clinic.id };
  }

  if (status === "active" && !isPaidSubscriptionActive(toAccessClinic(clinic))) {
    return { type: "expire_subscription", clinicId: clinic.id };
  }

  return { type: "none" };
}

export function reconcileClinics(clinics: ReconcileClinicRow[]) {
  let expiredTrials = 0;
  let expiredSubscriptions = 0;
  const actions: ReconcileAction[] = [];

  for (const clinic of clinics) {
    const action = planSubscriptionReconciliation(clinic);
    actions.push(action);
    if (action.type === "expire_trial") {
      expiredTrials += 1;
    }
    if (action.type === "expire_subscription") {
      expiredSubscriptions += 1;
    }
  }

  return {
    expiredTrials,
    expiredSubscriptions,
    checked: clinics.length,
    actions,
  };
}
