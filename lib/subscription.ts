import { extendMonthlyPeriod } from "./subscription-periods";

export const DUPLICATE_EMAIL_MESSAGE =
  "This email address has already used a 7-day free trial.";

/** @deprecated Use DUPLICATE_EMAIL_MESSAGE */
export const DUPLICATE_PHONE_MESSAGE = DUPLICATE_EMAIL_MESSAGE;

/** @deprecated Use DUPLICATE_EMAIL_MESSAGE */
export const TRIAL_ABUSE_MESSAGE = DUPLICATE_EMAIL_MESSAGE;

export const SUBSCRIPTION_PERIOD_DAYS = 30;

export {
  TRIAL_DAYS,
  SUBSCRIPTION_AMOUNT_INR,
  getSubscriptionAccessError,
  getSubscriptionLockKind,
  getTrialDaysRemaining,
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  normalizeSubscriptionStatus,
  trialEndsAtFromNow,
  trialEndsAtOnPaidActivation,
  firstChargeTimeFromNow,
} from "./subscription-access";

import { isPaidSubscriptionActive } from "./subscription-access";

/**
 * Skip Cashfree return-URL verification only when a paid period is already active.
 * Trial access must NOT skip verification — doctors may buy ₹999 during trial.
 */
export function shouldSkipCashfreePaymentFlow(
  clinic: Parameters<typeof isPaidSubscriptionActive>[0],
) {
  return isPaidSubscriptionActive(clinic);
}

export function extendSubscriptionExpiry(current: string | null | undefined) {
  return extendMonthlyPeriod(current).subscription_expires_at;
}
