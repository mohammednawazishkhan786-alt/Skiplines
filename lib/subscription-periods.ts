/** Calendar-month-aware billing period helpers (UTC). */

export const SUBSCRIPTION_CURRENCY = "INR";
export const SUBSCRIPTION_PLAN = "monthly_999";

function isSubscriptionTestMode(): boolean {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }

  return process.env.SUBSCRIPTION_TEST_MODE?.trim().toLowerCase() === "true";
}

const TEST_PERIOD_MS = 60_000;

export function resolveSubscriptionPlan(): string {
  return isSubscriptionTestMode() ? "test_1min" : SUBSCRIPTION_PLAN;
}

function extendTestPeriod(
  currentPeriodEnd: string | null | undefined,
  from = new Date(),
) {
  const periodMs = TEST_PERIOD_MS;
  const base =
    currentPeriodEnd && new Date(currentPeriodEnd) > from
      ? new Date(currentPeriodEnd)
      : from;
  const periodStart = startOfBillingPeriod(base);
  const periodEnd = new Date(periodStart.getTime() + periodMs);
  return {
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_date: periodEnd.toISOString(),
    last_payment_at: from.toISOString(),
    subscription_expires_at: periodEnd.toISOString(),
  };
}

export function addCalendarMonth(date: Date, months = 1): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() < day) {
    result.setUTCDate(0);
  }
  return result;
}

export function startOfBillingPeriod(from = new Date()): Date {
  return new Date(from.toISOString());
}

export function computeMonthlyPeriod(from = new Date()) {
  if (isSubscriptionTestMode()) {
    return extendTestPeriod(null, from);
  }

  const periodStart = startOfBillingPeriod(from);
  const periodEnd = addCalendarMonth(periodStart, 1);
  return {
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_date: periodEnd.toISOString(),
    last_payment_at: periodStart.toISOString(),
  };
}

export function extendMonthlyPeriod(
  currentPeriodEnd: string | null | undefined,
  from = new Date(),
) {
  if (isSubscriptionTestMode()) {
    return extendTestPeriod(currentPeriodEnd, from);
  }

  const base =
    currentPeriodEnd && new Date(currentPeriodEnd) > from
      ? new Date(currentPeriodEnd)
      : from;
  const periodStart = startOfBillingPeriod(base);
  const periodEnd = addCalendarMonth(periodStart, 1);
  return {
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_date: periodEnd.toISOString(),
    last_payment_at: from.toISOString(),
    subscription_expires_at: periodEnd.toISOString(),
  };
}
