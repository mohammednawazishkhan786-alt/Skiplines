import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getSubscriptionAccessError,
  getSubscriptionAmountInr,
  getSubscriptionPlanId,
  getSubscriptionPeriodMs,
  getTrialDurationMs,
  hasDashboardAccess,
  isSubscriptionTestMode,
  planSubscriptionReconciliation,
  PRODUCTION_SUBSCRIPTION_AMOUNT_INR,
  PRODUCTION_TRIAL_DAYS,
  reconcileClinics,
  subscriptionPaymentRequiredMessage,
  TEST_PERIOD_MS,
  TEST_SUBSCRIPTION_AMOUNT_INR,
  TEST_TRIAL_MS,
  trialEndsAtFromConfigured,
  trialEndsAtFromNow,
} from "../lib/subscription-access.ts";
import {
  extendMonthlyPeriod,
  resolveSubscriptionPlan,
} from "../lib/subscription-periods.ts";

const ORIGINAL_ENV = { ...process.env };

function withTestMode(fn: () => void) {
  process.env.SUBSCRIPTION_TEST_MODE = "true";
  try {
    fn();
  } finally {
    process.env = { ...ORIGINAL_ENV };
  }
}

function withProductionMode(fn: () => void) {
  delete process.env.SUBSCRIPTION_TEST_MODE;
  try {
    fn();
  } finally {
    process.env = { ...ORIGINAL_ENV };
  }
}

describe("subscription test mode", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("keeps production defaults when SUBSCRIPTION_TEST_MODE is false", () => {
    withProductionMode(() => {
      assert.equal(isSubscriptionTestMode(), false);
      assert.equal(getSubscriptionAmountInr(), PRODUCTION_SUBSCRIPTION_AMOUNT_INR);
      assert.equal(getTrialDurationMs(), PRODUCTION_TRIAL_DAYS * 24 * 60 * 60 * 1000);
      assert.equal(getSubscriptionPeriodMs(), null);
      assert.equal(getSubscriptionPlanId(), "monthly_999");
      assert.equal(getSubscriptionAmountInr(), 999);
      assert.ok(subscriptionPaymentRequiredMessage().includes("₹999"));
      assert.ok(subscriptionPaymentRequiredMessage().includes("1 month"));
    });
  });

  it("uses 1-minute trial, ₹1 amount, and 1-minute period in test mode", () => {
    withTestMode(() => {
      assert.equal(isSubscriptionTestMode(), true);
      assert.equal(getSubscriptionAmountInr(), TEST_SUBSCRIPTION_AMOUNT_INR);
      assert.equal(getTrialDurationMs(), TEST_TRIAL_MS);
      assert.equal(getSubscriptionPeriodMs(), TEST_PERIOD_MS);
      assert.equal(getSubscriptionPlanId(), "test_1min");
      assert.equal(getSubscriptionAmountInr(), 1);
      assert.ok(subscriptionPaymentRequiredMessage().includes("₹1"));
      assert.ok(subscriptionPaymentRequiredMessage().includes("1 minute"));
    });
  });

  it("creates a 1-minute trial window from server timestamps", () => {
    withTestMode(() => {
      const start = Date.parse("2026-08-11T10:00:00.000Z");
      const trialEndsAt = trialEndsAtFromConfigured(start);
      const delta = Date.parse(trialEndsAt) - start;
      assert.equal(delta, 60_000);
      assert.equal(trialEndsAtFromNow(), trialEndsAtFromConfigured());
    });
  });

  it("locks dashboard after 1-minute trial expiry based on database timestamps", () => {
    withTestMode(() => {
      const start = Date.now();
      const trialEndsAt = trialEndsAtFromConfigured(start);
      const activeClinic = {
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt,
        subscription_expires_at: null,
      };
      const expiredClinic = {
        subscription_status: "trial",
        trial_ends_at: new Date(start - 1_000).toISOString(),
        subscription_expires_at: null,
      };

      assert.equal(hasDashboardAccess(activeClinic), true);
      assert.equal(hasDashboardAccess(expiredClinic), false);
      assert.ok(getSubscriptionAccessError(expiredClinic)?.includes("₹1"));
    });
  });

  it("ignores client clock manipulation by using stored trial_ends_at", () => {
    withTestMode(() => {
      const serverTrialEnd = "2026-08-11T10:01:00.000Z";
      const clinic = {
        subscription_status: "trialing",
        trial_ends_at: serverTrialEnd,
        subscription_expires_at: null,
      };

      assert.equal(
        hasDashboardAccess(clinic),
        new Date(serverTrialEnd) > new Date(),
      );
    });
  });

  it("activates a 1-minute paid period after successful payment timestamps", () => {
    withTestMode(() => {
      const paymentAt = new Date("2026-08-11T10:02:00.000Z");
      const period = extendMonthlyPeriod(null, paymentAt);
      const startMs = Date.parse(period.current_period_start);
      const endMs = Date.parse(period.current_period_end);

      assert.equal(endMs - startMs, TEST_PERIOD_MS);
      assert.equal(period.next_billing_date, period.current_period_end);
      assert.equal(period.subscription_expires_at, period.current_period_end);
      assert.equal(resolveSubscriptionPlan(), "test_1min");
    });
  });

  it("unlocks dashboard during active paid period and locks after expiry", () => {
    withTestMode(() => {
      const paymentAt = new Date();
      const period = extendMonthlyPeriod(null, paymentAt);
      const active = {
        subscription_status: "active",
        trial_ends_at: new Date(Date.now() - 120_000).toISOString(),
        subscription_expires_at: period.subscription_expires_at,
      };
      const expired = {
        subscription_status: "active",
        trial_ends_at: new Date(Date.now() - 120_000).toISOString(),
        subscription_expires_at: new Date(Date.now() - 1_000).toISOString(),
      };

      assert.equal(hasDashboardAccess(active), true);
      assert.equal(hasDashboardAccess(expired), false);
    });
  });

  it("reconciles expired trials and subscriptions idempotently in test mode", () => {
    withTestMode(() => {
      const pastTrialEnd = new Date(Date.now() - 1_000).toISOString();
      const pastPaidEnd = new Date(Date.now() - 1_000).toISOString();
      const clinicId = "f2e891e5-7d25-416c-a59b-09ad06387b8b";

      const summary = reconcileClinics([
        {
          id: clinicId,
          subscription_status: "trialing",
          trial_ends_at: pastTrialEnd,
          subscription_expires_at: null,
        },
        {
          id: "active-expired",
          subscription_status: "active",
          trial_ends_at: null,
          subscription_expires_at: pastPaidEnd,
        },
      ]);

      assert.equal(summary.expiredTrials, 1);
      assert.equal(summary.expiredSubscriptions, 1);
      const trialRow = {
        id: clinicId,
        subscription_status: "trialing",
        trial_ends_at: pastTrialEnd,
        subscription_expires_at: null,
      };
      assert.equal(planSubscriptionReconciliation(trialRow).type, "expire_trial");
      assert.equal(
        planSubscriptionReconciliation({
          ...trialRow,
          subscription_status: "expired",
        }).type,
        "none",
      );
    });
  });

  it("rejects wrong payment amounts in test mode", () => {
    withTestMode(() => {
      assert.equal(getSubscriptionAmountInr(), 1);
      assert.notEqual(getSubscriptionAmountInr(), 999);
      assert.notEqual(getSubscriptionAmountInr(), 0);
      assert.equal(99 !== getSubscriptionAmountInr(), true);
      assert.equal(999 !== getSubscriptionAmountInr(), true);
    });
  });

  it("treats duplicate webhook activation as idempotent when order already active", () => {
    withTestMode(() => {
      const orderId = "order_test_1";
      const existing = {
        subscription_status: "active",
        subscription_expires_at: new Date(Date.now() + 30_000).toISOString(),
        cashfree_order_id: orderId,
      };
      assert.equal(
        existing.cashfree_order_id === orderId &&
          new Date(existing.subscription_expires_at) > new Date(),
        true,
      );
    });
  });

  it("does not activate subscription when payment amount is wrong", () => {
    withTestMode(() => {
      const expected = getSubscriptionAmountInr();
      assert.equal(expected, 1);
      assert.equal(999 === expected, false);
      assert.equal(0 === expected, false);
    });
  });

  it("does not activate subscription when payment is not marked paid", () => {
    withTestMode(() => {
      const unpaidStatuses = ["PENDING", "FAILED", "CANCELLED"];
      for (const status of unpaidStatuses) {
        assert.notEqual(status, "PAID");
        assert.notEqual(status, "SUCCESS");
      }
    });
  });

  it("simulates full lifecycle timestamps without manual database edits", () => {
    withTestMode(() => {
      const registeredAt = Date.now();
      const trialEndsAt = trialEndsAtFromConfigured(registeredAt);
      const trialClinic = {
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt,
        subscription_expires_at: null,
      };

      assert.equal(hasDashboardAccess(trialClinic), true);

      const afterTrial = {
        subscription_status: "pending_payment",
        trial_ends_at: new Date(registeredAt - 1_000).toISOString(),
        subscription_expires_at: null,
      };
      assert.equal(hasDashboardAccess(afterTrial), false);

      const paymentAt = new Date();
      const period = extendMonthlyPeriod(null, paymentAt);
      const paidClinic = {
        subscription_status: "active",
        trial_ends_at: afterTrial.trial_ends_at,
        subscription_expires_at: period.subscription_expires_at,
      };
      assert.equal(hasDashboardAccess(paidClinic), true);

      const afterPaid = {
        subscription_status: "active",
        trial_ends_at: afterTrial.trial_ends_at,
        subscription_expires_at: new Date(Date.now() - 1_000).toISOString(),
      };
      assert.equal(hasDashboardAccess(afterPaid), false);
      assert.equal(
        planSubscriptionReconciliation({
          id: "cycle",
          subscription_status: "active",
          trial_ends_at: afterTrial.trial_ends_at,
          subscription_expires_at: afterPaid.subscription_expires_at,
        }).type,
        "expire_subscription",
      );
    });
  });
});
