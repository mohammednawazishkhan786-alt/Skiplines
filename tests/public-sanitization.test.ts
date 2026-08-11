/**
 * Regression tests for public response sanitization + subscription constants.
 * Never assert real secrets. Never enable Production test mode here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicToken } from "../lib/public-token.ts";
import { toPublicClinic } from "../lib/public-clinic.ts";
import {
  PRODUCTION_SUBSCRIPTION_AMOUNT_INR,
  PRODUCTION_TRIAL_DAYS,
  getSubscriptionAmountInr,
  isSubscriptionTestMode,
} from "../lib/subscription-access.ts";

describe("public response sanitization", () => {
  it("toPublicToken strips patient PII", () => {
    const publicToken = toPublicToken({
      id: "11111111-1111-1111-1111-111111111111",
      clinic_id: "22222222-2222-2222-2222-222222222222",
      token_number: 3,
      queue_position: 2,
      status: "waiting",
      is_emergency: false,
      is_late: false,
      estimated_call_at: null,
      completed_at: null,
      late_shift_count: 0,
      created_at: "2026-08-11T00:00:00.000Z",
      patient_name: "Secret Patient",
      patient_phone: "9999999999",
    });

    assert.equal(
      Object.prototype.hasOwnProperty.call(publicToken, "patient_name"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicToken, "patient_phone"),
      false,
    );
    assert.equal(publicToken.token_number, 3);
  });

  it("toPublicClinic strips doctor contact + billing fields", () => {
    const publicClinic = toPublicClinic({
      id: "22222222-2222-2222-2222-222222222222",
      doctor_name: "Dr Test",
      clinic_name: "Test Clinic",
      email: "secret@example.com",
      phone: "9999999999",
      avg_time_per_patient: 10,
      current_token: 1,
      consultation_fee: 500,
      clinic_hours: null,
      google_review_link: null,
      whatsapp_number: null,
      razorpay_subscription_id: null,
      subscription_status: "active",
      trial_ends_at: null,
      created_at: "2026-08-11T00:00:00.000Z",
      cashfree_order_id: "order_x",
      phone_normalized: null,
      cashfree_subscription_id: null,
      subscription_expires_at: null,
      trial_started_at: null,
      current_period_start: null,
      current_period_end: null,
      next_billing_date: null,
      last_payment_at: null,
      subscription_amount: 999,
      subscription_currency: "INR",
      payment_provider: "cashfree",
      subscription_plan: "monthly_999",
      cancelled_at: null,
      expired_at: null,
      updated_at: null,
    } as never);

    assert.equal(
      Object.prototype.hasOwnProperty.call(publicClinic, "email"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicClinic, "phone"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicClinic, "subscription_status"),
      false,
    );
    assert.equal(publicClinic.clinic_name, "Test Clinic");
  });
});

describe("production subscription constants", () => {
  it("keeps ₹999 and 7-day trial when test mode is off", () => {
    assert.equal(isSubscriptionTestMode(), false);
    assert.equal(PRODUCTION_SUBSCRIPTION_AMOUNT_INR, 999);
    assert.equal(PRODUCTION_TRIAL_DAYS, 7);
    assert.equal(getSubscriptionAmountInr(), 999);
  });
});
