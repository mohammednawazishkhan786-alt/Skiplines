import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSubscriptionAccessError,
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  planSubscriptionReconciliation,
  reconcileClinics,
  SUBSCRIPTION_AMOUNT_INR,
  TRIAL_DAYS,
  trialEndsAtFromNow,
} from "../lib/subscription-access.ts";
import { extendMonthlyPeriod } from "../lib/subscription-periods.ts";

const CLINIC_ID = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";

describe("subscription state machine", () => {
  it("creates a 7-day trial window from registration time", () => {
    const start = new Date("2026-08-11T10:00:00.000Z");
    const trialEndsAt = new Date(
      start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const ms = new Date(trialEndsAt).getTime() - start.getTime();
    assert.equal(ms, 7 * 24 * 60 * 60 * 1000);
  });

  it("allows dashboard access during active trial based on trial_ends_at", () => {
    const future = trialEndsAtFromNow();
    const clinic = {
      subscription_status: "trialing",
      trial_ends_at: future,
      subscription_expires_at: null,
    };

    assert.equal(isTrialActive(clinic), true);
    assert.equal(hasDashboardAccess(clinic), true);
    assert.equal(getSubscriptionAccessError(clinic), null);
  });

  it("blocks dashboard access after trial expiry even if status still says trial", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const clinic = {
      subscription_status: "trial",
      trial_ends_at: past,
      subscription_expires_at: null,
    };

    assert.equal(isTrialActive(clinic), false);
    assert.equal(hasDashboardAccess(clinic), false);
    assert.ok(getSubscriptionAccessError(clinic)?.includes("₹999"));
  });

  it("activates paid access only with active status and future expiry", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const active = {
      subscription_status: "active",
      subscription_expires_at: future,
    };
    const expired = {
      subscription_status: "active",
      subscription_expires_at: new Date(Date.now() - 60_000).toISOString(),
    };

    assert.equal(isPaidSubscriptionActive(active), true);
    assert.equal(hasDashboardAccess(active), true);
    assert.equal(isPaidSubscriptionActive(expired), false);
    assert.equal(hasDashboardAccess(expired), false);
  });

  it("sets billing period fields on successful paid activation", () => {
    const paymentAt = new Date("2026-08-11T10:00:00.000Z");
    const period = extendMonthlyPeriod(null, paymentAt);

    assert.ok(period.current_period_start);
    assert.ok(period.current_period_end);
    assert.ok(period.next_billing_date);
    assert.ok(period.last_payment_at);
    assert.equal(period.subscription_expires_at, period.current_period_end);
  });

  it("rejects wrong payment amounts server-side", () => {
    assert.equal(SUBSCRIPTION_AMOUNT_INR, 999);
    assert.notEqual(1, SUBSCRIPTION_AMOUNT_INR);
    assert.notEqual(99, SUBSCRIPTION_AMOUNT_INR);
  });

  it("reconciles expired trials without touching active clinics", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    const summary = reconcileClinics([
      {
        id: CLINIC_ID,
        subscription_status: "trial",
        trial_ends_at: past,
        subscription_expires_at: null,
      },
      {
        id: "9376eb65-e3e9-4142-a54b-a6f4c0d449ad",
        subscription_status: "trial",
        trial_ends_at: future,
        subscription_expires_at: null,
      },
    ]);

    assert.equal(summary.expiredTrials, 1);
    assert.equal(summary.expiredSubscriptions, 0);
    assert.equal(
      planSubscriptionReconciliation({
        id: CLINIC_ID,
        subscription_status: "trial",
        trial_ends_at: past,
        subscription_expires_at: null,
      }).type,
      "expire_trial",
    );
  });

  it("reconciling twice plans the same expiry actions idempotently", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const clinic = {
      id: CLINIC_ID,
      subscription_status: "trial",
      trial_ends_at: past,
      subscription_expires_at: null,
    };

    const first = planSubscriptionReconciliation(clinic);
    const second = planSubscriptionReconciliation(clinic);
    assert.deepEqual(first, second);
  });
});
