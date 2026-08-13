import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDoctorToken,
  verifyDoctorAuth,
  verifyDoctorToken,
} from "../lib/auth/doctor-token.ts";
import { toPublicClinic } from "../lib/public-clinic.ts";
import { toPublicToken } from "../lib/public-token.ts";
import {
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  SUBSCRIPTION_AMOUNT_INR,
  trialEndsAtFromNow,
} from "../lib/subscription-access.ts";
import {
  addCalendarMonth,
  computeMonthlyPeriod,
  extendMonthlyPeriod,
} from "../lib/subscription-periods.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";
import {
  isDevOtpBypassEnabled,
  isProductionRuntime,
  isSubscriptionTestModeEnabled,
  resolveResendFromEmail,
} from "../lib/env.ts";

describe("production hardening", () => {
  it("requires service role key in production for admin client", () => {
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      assert.throws(
        () => createAdminClient(),
        /SUPABASE_SERVICE_ROLE_KEY must be configured in production/,
      );
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      process.env.NODE_ENV = previousNode;
      process.env.VERCEL_ENV = previousVercel;
    }
  });

  it("requires dedicated doctor auth secret in production", () => {
    const previous = process.env.DOCTOR_AUTH_SECRET;
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    delete process.env.DOCTOR_AUTH_SECRET;

    try {
      assert.throws(() => createDoctorToken("test-clinic-id"));
    } finally {
      process.env.DOCTOR_AUTH_SECRET = previous;
      process.env.NODE_ENV = previousNode;
      process.env.VERCEL_ENV = previousVercel;
    }
  });

  it("signs and verifies doctor tokens with secret", () => {
    const previous = process.env.DOCTOR_AUTH_SECRET;
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    process.env.DOCTOR_AUTH_SECRET = "test_secret_for_unit_tests_only_32chars";
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;

    try {
      const clinicId = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";
      const token = createDoctorToken(clinicId);
      const payload = verifyDoctorToken(token);
      assert.equal(payload?.clinicId, clinicId);

      const request = new Request("https://www.skiplines.in/api/clinics/x", {
        headers: { cookie: `doctor_token=${encodeURIComponent(token)}` },
      });
      assert.equal(verifyDoctorAuth(request, clinicId), true);
      assert.equal(
        verifyDoctorAuth(request, "9376eb65-e3e9-4142-a54b-a6f4c0d449ad"),
        false,
      );
    } finally {
      process.env.DOCTOR_AUTH_SECRET = previous;
      process.env.NODE_ENV = previousNode;
      process.env.VERCEL_ENV = previousVercel;
    }
  });

  it("uses ₹999 production subscription amount", () => {
    assert.equal(SUBSCRIPTION_AMOUNT_INR, 999);
  });

  it("ignores OTP_DEV_BYPASS and SUBSCRIPTION_TEST_MODE on production runtime", () => {
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    const previousOtpBypass = process.env.OTP_DEV_BYPASS;
    const previousSubTest = process.env.SUBSCRIPTION_TEST_MODE;

    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.OTP_DEV_BYPASS = "true";
    process.env.SUBSCRIPTION_TEST_MODE = "true";

    try {
      assert.equal(isProductionRuntime(), true);
      assert.equal(isDevOtpBypassEnabled(), false);
      assert.equal(isSubscriptionTestModeEnabled(), false);
    } finally {
      process.env.NODE_ENV = previousNode;
      process.env.VERCEL_ENV = previousVercel;
      process.env.OTP_DEV_BYPASS = previousOtpBypass;
      process.env.SUBSCRIPTION_TEST_MODE = previousSubTest;
    }
  });

  it("allows dev bypass flags only outside production runtime", () => {
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL_ENV;
    const previousOtpBypass = process.env.OTP_DEV_BYPASS;
    const previousSubTest = process.env.SUBSCRIPTION_TEST_MODE;

    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    process.env.OTP_DEV_BYPASS = "true";
    process.env.SUBSCRIPTION_TEST_MODE = "true";

    try {
      assert.equal(isDevOtpBypassEnabled(), true);
      assert.equal(isSubscriptionTestModeEnabled(), true);
    } finally {
      process.env.NODE_ENV = previousNode;
      process.env.VERCEL_ENV = previousVercel;
      process.env.OTP_DEV_BYPASS = previousOtpBypass;
      process.env.SUBSCRIPTION_TEST_MODE = previousSubTest;
    }
  });

  it("uses RESEND_FROM_EMAIL when configured with production fallback", () => {
    const previous = process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_FROM_EMAIL;
    try {
      assert.equal(resolveResendFromEmail(), "Skiplines <otp@skiplines.in>");
      process.env.RESEND_FROM_EMAIL = "Custom <custom@example.com>";
      assert.equal(resolveResendFromEmail(), "Custom <custom@example.com>");
    } finally {
      process.env.RESEND_FROM_EMAIL = previous;
    }
  });

  it("enforces 7-day trial access from database timestamps", () => {
    const future = trialEndsAtFromNow();
    assert.equal(
      isTrialActive({ subscription_status: "trialing", trial_ends_at: future }),
      true,
    );
    assert.equal(
      hasDashboardAccess({
        subscription_status: "trialing",
        trial_ends_at: future,
        subscription_expires_at: null,
      }),
      true,
    );

    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(
      hasDashboardAccess({
        subscription_status: "trialing",
        trial_ends_at: past,
        subscription_expires_at: null,
      }),
      false,
    );
  });

  it("activates paid access only when status and expiry are valid", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(
      isPaidSubscriptionActive({
        subscription_status: "active",
        subscription_expires_at: future,
      }),
      true,
    );
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(
      isPaidSubscriptionActive({
        subscription_status: "active",
        subscription_expires_at: past,
      }),
      false,
    );
  });

  it("computes monthly billing periods with calendar months", () => {
    const start = new Date("2026-01-31T10:00:00.000Z");
    const next = addCalendarMonth(start, 1);
    assert.equal(next.getUTCMonth(), 1);
    const period = computeMonthlyPeriod(start);
    assert.ok(period.current_period_start);
    assert.ok(period.current_period_end);
    assert.ok(period.next_billing_date);
    const extended = extendMonthlyPeriod(null, start);
    assert.ok(extended.subscription_expires_at);
  });

  it("strips private clinic fields from public responses", () => {
    const sanitized = toPublicClinic({
      id: "adda7e3d-70bb-4c40-8ef9-42740b9f1762",
      doctor_name: "Dr. Test",
      clinic_name: "Test Clinic",
      email: "secret@example.com",
      phone: "9999999999",
      avg_time_per_patient: 10,
      current_token: 3,
      consultation_fee: 500,
      clinic_hours: "9-5",
      google_review_link: null,
      whatsapp_number: "9999999999",
      razorpay_subscription_id: null,
      cashfree_order_id: null,
      cashfree_subscription_id: null,
      phone_normalized: "9999999999",
      subscription_expires_at: null,
      trial_started_at: null,
      current_period_start: null,
      current_period_end: null,
      next_billing_date: null,
      last_payment_at: null,
      subscription_amount: 999,
      subscription_currency: "INR",
      subscription_plan: "monthly_999",
      payment_provider: "cashfree",
      cancelled_at: null,
      expired_at: null,
      updated_at: null,
      subscription_status: "active",
      trial_ends_at: null,
      created_at: new Date().toISOString(),
    });

    assert.equal("email" in sanitized, false);
    assert.equal("phone" in sanitized, false);
    assert.equal("subscription_status" in sanitized, false);
    assert.equal("cashfree_order_id" in sanitized, false);
  });

  it("strips private token fields from public queue responses", () => {
    const sanitized = toPublicToken({
      id: "7154afb1-9b32-466c-babc-69dfcc2569ba",
      clinic_id: "adda7e3d-70bb-4c40-8ef9-42740b9f1762",
      token_number: 2,
      queue_position: 1,
      status: "waiting",
      patient_phone: "9999999999",
      patient_name: "Secret Patient",
      is_emergency: false,
      is_late: false,
      review_sent: false,
      confirmed_at: null,
      estimated_call_at: null,
      completed_at: null,
      late_shift_count: 0,
      confirmation_sent: false,
      created_at: new Date().toISOString(),
    });

    assert.equal("patient_phone" in sanitized, false);
    assert.equal("patient_name" in sanitized, false);
    assert.equal(sanitized.token_number, 2);
  });
});
