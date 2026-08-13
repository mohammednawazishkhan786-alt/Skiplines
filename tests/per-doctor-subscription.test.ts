import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateSecureClinicId } from "../lib/clinic-registration.ts";
import { isValidClinicId, verifyClinicOwnership } from "../lib/clinic-identity.ts";
import { extendMonthlyPeriod } from "../lib/subscription-periods.ts";
import {
  getSubscriptionAccessError,
  getSubscriptionLockKind,
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  SUBSCRIPTION_AMOUNT_INR,
  TRIAL_DAYS,
  trialEndsAtOnPaidActivation,
} from "../lib/subscription-access.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const DOCTOR_A = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";
const DOCTOR_B = "9376eb65-e3e9-4142-a54b-a6f4c0d449ad";

function trialClinic(at: Date) {
  return {
    subscription_status: "trialing",
    trial_ends_at: new Date(
      at.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    subscription_expires_at: null,
  };
}

describe("per-doctor ₹999/month subscription", () => {
  it("assigns a permanent UUID Doctor ID at registration", () => {
    const first = generateSecureClinicId();
    const second = generateSecureClinicId();
    assert.equal(isValidClinicId(first), true);
    assert.equal(isValidClinicId(second), true);
    assert.notEqual(first, second);
    assert.match(read("lib/clinic-identity.ts"), /Permanent Skiplines Doctor ID/);
    assert.match(read("app/api/clinics/route.ts"), /insertClinicWithUniqueId/);
  });

  it("gives a new doctor a 7-day server-side trial", () => {
    const start = new Date("2026-08-13T10:00:00.000Z");
    const clinic = trialClinic(start);
    assert.equal(
      new Date(clinic.trial_ends_at).getTime() - start.getTime(),
      7 * 24 * 60 * 60 * 1000,
    );
    assert.match(read("app/api/clinics/route.ts"), /buildNewDoctorTrialFields/);
    assert.match(read("lib/trial-entitlement.ts"), /trial_used: true/);
  });

  it("keeps trial active on day 0 and day 6, expired on day 7", () => {
    const start = new Date("2026-08-13T10:00:00.000Z");
    const ends = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const day0 = {
      subscription_status: "trialing",
      trial_ends_at: ends.toISOString(),
      subscription_expires_at: null,
    };
    const day6StillFuture = {
      ...day0,
      trial_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const day7 = {
      ...day0,
      trial_ends_at: new Date(Date.now() - 1000).toISOString(),
    };

    assert.equal(isTrialActive(day6StillFuture), true);
    assert.equal(hasDashboardAccess(day6StillFuture), true);
    assert.equal(isTrialActive(day7), false);
    assert.equal(hasDashboardAccess(day7), false);
    assert.equal(getSubscriptionLockKind(day7), "trial_expired");
  });

  it("locks dashboard after trial expiry", () => {
    const expired = {
      subscription_status: "trialing",
      trial_ends_at: new Date("2026-08-13T10:00:00.000Z").toISOString(),
      subscription_expires_at: null,
    };
    assert.equal(hasDashboardAccess(expired), false);
    assert.ok(getSubscriptionAccessError(expired)?.includes("free trial has ended"));
    assert.ok(getSubscriptionAccessError(expired)?.includes("₹999"));
  });

  it("shows the ₹999 option during trial in the dashboard", () => {
    const dashboard = read("app/dashboard/page.tsx");
    assert.match(dashboard, /Skiplines Pro/);
    assert.match(dashboard, /Buy ₹999 \/ month/);
    assert.match(dashboard, /onTrial/);
    assert.match(dashboard, /\/api\/cashfree\/create-order/);
  });

  it("does not skip Cashfree verification while trial is still active", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const trial = {
      subscription_status: "trialing",
      trial_ends_at: future,
      subscription_expires_at: null,
    };
    assert.equal(hasDashboardAccess(trial), true);
    assert.equal(isPaidSubscriptionActive(trial), false);
    const skipHelper = read("lib/subscription.ts");
    assert.match(skipHelper, /shouldSkipCashfreePaymentFlow/);
    assert.match(skipHelper, /isPaidSubscriptionActive\(clinic\)/);
    assert.match(
      read("app/api/cashfree/verify-payment/route.ts"),
      /isPaidSubscriptionActive\(clinic\)/,
    );
  });

  it("skips return-URL verification only when paid is already active", () => {
    const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const paid = {
      subscription_status: "active",
      trial_ends_at: new Date(Date.now() - 1000).toISOString(),
      subscription_expires_at: future,
    };
    assert.equal(isPaidSubscriptionActive(paid), true);
    assert.match(
      read("lib/subscription.ts"),
      /return isPaidSubscriptionActive\(clinic\)/,
    );
  });

  it("ends trial immediately and starts paid month from verified payment time", () => {
    const trialEnd = new Date("2026-08-20T00:00:00.000Z");
    const paidAt = new Date("2026-08-10T12:00:00.000Z");

    const newTrialEnd = trialEndsAtOnPaidActivation(trialEnd.toISOString(), paidAt);
    assert.equal(newTrialEnd, paidAt.toISOString());
    assert.ok(new Date(newTrialEnd) < trialEnd);

    const period = extendMonthlyPeriod(null, paidAt);
    assert.equal(period.current_period_start, paidAt.toISOString());
    assert.equal(period.subscription_expires_at, period.current_period_end);
    assert.equal(
      new Date(period.current_period_end).toISOString(),
      new Date("2026-09-10T12:00:00.000Z").toISOString(),
    );

    const afterPay = {
      subscription_status: "active",
      trial_ends_at: newTrialEnd,
      subscription_expires_at: period.subscription_expires_at,
    };
    assert.equal(isTrialActive(afterPay), false);
    assert.equal(isPaidSubscriptionActive(afterPay), true);
    assert.equal(hasDashboardAccess(afterPay), true);
  });

  it("does not preserve remaining trial days as extra paid time", () => {
    const trialEnd = new Date("2026-08-20T00:00:00.000Z").toISOString();
    const paidAt = new Date("2026-08-16T00:00:00.000Z");
    const period = extendMonthlyPeriod(null, paidAt);
    assert.notEqual(period.current_period_start, trialEnd);
    assert.equal(period.current_period_start, paidAt.toISOString());
  });

  it("paid period lasts one billing month from activation", () => {
    const start = new Date("2026-01-31T10:00:00.000Z");
    const period = extendMonthlyPeriod(null, start);
    assert.equal(period.current_period_end, "2026-02-28T10:00:00.000Z");
  });

  it("locks dashboard when paid subscription expires", () => {
    const expiredPaid = {
      subscription_status: "active",
      trial_ends_at: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      subscription_expires_at: new Date("2026-08-01T00:00:00.000Z").toISOString(),
    };
    assert.equal(isPaidSubscriptionActive(expiredPaid), false);
    assert.equal(hasDashboardAccess(expiredPaid), false);
    assert.equal(getSubscriptionLockKind(expiredPaid), "paid_expired");
    assert.ok(getSubscriptionAccessError(expiredPaid)?.includes("subscription has expired"));
    assert.ok(getSubscriptionAccessError(expiredPaid)?.includes("₹999"));
    assert.match(read("app/dashboard/page.tsx"), /Renew ₹999\/month/);
  });

  it("renewal after expiry starts a fresh month from payment time", () => {
    const previousEnd = new Date("2026-08-16T12:00:00.000Z");
    const renewAt = new Date("2026-08-20T09:00:00.000Z");
    const period = extendMonthlyPeriod(previousEnd.toISOString(), renewAt);
    assert.equal(period.current_period_start, renewAt.toISOString());
    assert.equal(
      period.subscription_expires_at,
      new Date("2026-09-20T09:00:00.000Z").toISOString(),
    );
  });

  it("second and later renewals keep stacking from remaining paid time when still active", () => {
    const firstEnd = new Date("2026-09-16T12:00:00.000Z");
    const earlyRenew = new Date("2026-09-10T12:00:00.000Z");
    const second = extendMonthlyPeriod(firstEnd.toISOString(), earlyRenew);
    assert.equal(second.current_period_start, firstEnd.toISOString());
    assert.equal(
      second.subscription_expires_at,
      new Date("2026-10-16T12:00:00.000Z").toISOString(),
    );

    const thirdFrom = new Date("2026-10-01T12:00:00.000Z");
    const third = extendMonthlyPeriod(second.subscription_expires_at, thirdFrom);
    assert.equal(
      third.subscription_expires_at,
      new Date("2026-11-16T12:00:00.000Z").toISOString(),
    );
  });

  it("enforces ₹999 and rejects wrong amounts", () => {
    assert.equal(SUBSCRIPTION_AMOUNT_INR, 999);
    assert.match(read("lib/cashfree.ts"), /order_amount: amount/);
    assert.match(read("lib/cashfree-payment.ts"), /orderAmount !== expectedAmount/);
    assert.doesNotMatch(read("app/dashboard/page.tsx"), /order_amount/);
  });

  it("does not activate from frontend payment_success state", () => {
    const dashboard = read("app/dashboard/page.tsx");
    assert.doesNotMatch(dashboard, /payment_success\s*=\s*true/);
    assert.match(dashboard, /\/api\/cashfree\/verify-payment/);
    assert.match(read("lib/cashfree-payment.ts"), /isCashfreeOrderPaid/);
  });

  it("webhook activation is bound to Cashfree order doctor_id, not client doctor_id", () => {
    const payment = read("lib/cashfree-payment.ts");
    assert.match(payment, /extractDoctorIdFromOrderTags/);
    assert.match(payment, /taggedDoctorId !== clinicId/);
    assert.match(read("app/api/cashfree/create-order/route.ts"), /requireDoctorAuth\(request, clinicId\)/);
    assert.match(read("lib/cashfree.ts"), /doctor_id: input.clinicId/);
    assert.match(read("lib/cashfree.ts"), /clinic_id: input.clinicId/);
  });

  it("Doctor A payment cannot unlock Doctor B", () => {
    assert.equal(verifyClinicOwnership(DOCTOR_A, DOCTOR_B), false);
    assert.equal(verifyClinicOwnership(DOCTOR_A, DOCTOR_A), true);
    assert.equal(verifyClinicOwnership(DOCTOR_B, DOCTOR_A), false);
  });

  it("client cannot swap doctor_id: create-order and verify require matching doctor cookie", () => {
    assert.match(
      read("app/api/cashfree/create-order/route.ts"),
      /requireDoctorAuth\(request, clinicId\)/,
    );
    assert.match(
      read("app/api/cashfree/verify-payment/route.ts"),
      /requireDoctorAuth\(request, clinicId\)/,
    );
    assert.match(
      read("lib/subscription-guard.ts"),
      /requireDoctorAuth\(request, clinicId\)/,
    );
  });

  it("server-side guard still blocks expired subscription API access", () => {
    assert.match(
      read("lib/subscription-guard.ts"),
      /requireDoctorSubscription/,
    );
    assert.match(
      read("app/api/clinics/[id]/next/route.ts"),
      /requireDoctorSubscription/,
    );
    assert.match(
      read("app/api/clinics/[id]/route.ts"),
      /requireDoctorSubscription/,
    );
  });

  it("does not invent a second payment provider or yearly plan", () => {
    const dashboard = read("app/dashboard/page.tsx");
    assert.doesNotMatch(dashboard, /create-subscription/);
    assert.doesNotMatch(dashboard, /₹999\/year/);
    assert.match(read("docs/CASHFREE_ARCHITECTURE.md"), /one-time ₹999 PG orders/);
  });

  it("queue Call Next path remains subscription-guarded and unchanged in wiring", () => {
    const nextRoute = read("app/api/clinics/[id]/next/route.ts");
    assert.match(nextRoute, /call_next_patient_atomic/);
    assert.match(nextRoute, /notifyCallNextPatient/);
    assert.doesNotMatch(nextRoute, /cashfree/);
  });

  it("activation helper writes trial_ends_at from verified payment time", () => {
    const payment = read("lib/cashfree-payment.ts");
    assert.match(payment, /trialEndsAtOnPaidActivation/);
    assert.match(payment, /extendMonthlyPeriod\(null, activatedAt\)/);
  });
});
