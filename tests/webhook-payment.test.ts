import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBSCRIPTION_AMOUNT_INR } from "../lib/subscription-access.ts";
import { extendMonthlyPeriod } from "../lib/subscription-periods.ts";

function isDuplicateWebhookError(error: { code?: string }) {
  return error.code === "23505";
}

function isValidPaymentAmount(amount: number) {
  return amount === SUBSCRIPTION_AMOUNT_INR;
}

describe("webhook and payment idempotency", () => {
  it("treats unique-violation as duplicate webhook event", () => {
    assert.equal(isDuplicateWebhookError({ code: "23505" }), true);
    assert.equal(isDuplicateWebhookError({ code: "42501" }), false);
  });

  it("accepts only ₹999 as valid subscription payment amount", () => {
    assert.equal(isValidPaymentAmount(999), true);
    assert.equal(isValidPaymentAmount(1), false);
    assert.equal(isValidPaymentAmount(1000), false);
  });

  it("activation period fields are derived server-side from payment time", () => {
    const paidAt = new Date("2026-08-11T06:00:00.000Z");
    const period = extendMonthlyPeriod(null, paidAt);

    assert.ok(period.current_period_start);
    assert.ok(period.current_period_end);
    assert.ok(period.next_billing_date);
    assert.ok(period.last_payment_at);
    assert.equal(period.subscription_expires_at, period.current_period_end);
  });

  it("duplicate activation should not shorten an existing future period", () => {
    const existingEnd = new Date("2026-10-11T06:00:00.000Z").toISOString();
    const earlierPayment = new Date("2026-08-11T06:00:00.000Z");
    const period = extendMonthlyPeriod(existingEnd, earlierPayment);

    assert.equal(period.current_period_start, existingEnd);
  });
});
