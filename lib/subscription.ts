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
  getTrialDaysRemaining,
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  normalizeSubscriptionStatus,
  trialEndsAtFromNow,
  firstChargeTimeFromNow,
} from "./subscription-access";

import { hasDashboardAccess } from "./subscription-access";

export function shouldSkipCashfreePaymentFlow(
  clinic: Parameters<typeof hasDashboardAccess>[0],
) {
  return hasDashboardAccess(clinic);
}

export function extendSubscriptionExpiry(current: string | null | undefined) {
  return extendMonthlyPeriod(current).subscription_expires_at;
}
