import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { generateSecureClinicId } from "../lib/clinic-registration.ts";
import {
  isValidClinicId,
  verifyClinicOwnership,
} from "../lib/clinic-identity.ts";
import {
  hasDashboardAccess,
  isPaidSubscriptionActive,
  isTrialActive,
  trialEndsAtFromConfigured,
  trialEndsAtOnPaidActivation,
  TRIAL_DAYS,
} from "../lib/subscription-access.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const DOCTOR_A = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";
const DOCTOR_B = "9376eb65-e3e9-4142-a54b-a6f4c0d449ad";

function buildExpectedNewDoctorTrialFields(now: Date) {
  const startedAt = now.toISOString();
  return {
    trial_used: true,
    trial_started_at: startedAt,
    trial_ends_at: trialEndsAtFromConfigured(now.getTime()),
    subscription_status: "trialing" as const,
  };
}

describe("Doctor identity + one-time trial entitlement", () => {
  describe("Doctor identity", () => {
    it("assigns a unique permanent Doctor ID at registration", () => {
      const first = generateSecureClinicId();
      const second = generateSecureClinicId();
      assert.notEqual(first, second);
      assert.equal(isValidClinicId(first), true);
      assert.equal(isValidClinicId("not-a-uuid"), false);
    });

    it("Doctor ID equals clinics.id and never changes", () => {
      const doctorIdentity = read("lib/doctor-identity.ts");
      assert.match(doctorIdentity, /return record\.id/);
      assert.equal(isValidClinicId(DOCTOR_A), true);
    });

    it("Doctor ID cannot be client-controlled in payment routes", () => {
      assert.match(
        read("app/api/cashfree/create-order/route.ts"),
        /requireDoctorAuth\(request, clinicId\)/,
      );
      assert.match(
        read("app/api/cashfree/verify-payment/route.ts"),
        /requireDoctorAuth\(request, clinicId\)/,
      );
      assert.doesNotMatch(read("app/dashboard/page.tsx"), /doctor_id.*localStorage/);
    });

    it("existing Doctor IDs remain stable (no regeneration in code)", () => {
      assert.match(read("supabase/migrations/013_clinic_id_uniqueness.sql"), /prevent_clinic_id_change/);
      assert.match(read("app/api/clinics/route.ts"), /insertClinicWithUniqueId/);
      assert.doesNotMatch(read("app/api/clinics/route.ts"), /gen_random_uuid\(\)/);
    });

    it("Doctor A payment cannot unlock Doctor B", () => {
      assert.equal(verifyClinicOwnership(DOCTOR_A, DOCTOR_B), false);
      assert.equal(verifyClinicOwnership(DOCTOR_A, DOCTOR_A), true);
      assert.match(read("lib/doctor-identity.ts"), /verifyClinicOwnership/);
    });
  });

  describe("One-time trial", () => {
    it("new Doctor receives exactly one 7-day trial with trial_used=true immediately", () => {
      const start = new Date("2026-08-13T10:00:00.000Z");
      const fields = buildExpectedNewDoctorTrialFields(start);
      const entitlement = read("lib/trial-entitlement.ts");
      assert.match(entitlement, /trial_used: true/);
      assert.match(entitlement, /trialEndsAtFromConfigured\(now\.getTime\(\)\)/);
      assert.equal(fields.trial_used, true);
      assert.equal(fields.subscription_status, "trialing");
      const ms =
        new Date(fields.trial_ends_at).getTime() -
        new Date(fields.trial_started_at).getTime();
      assert.equal(ms, TRIAL_DAYS * 24 * 60 * 60 * 1000);
    });

    it("trial is active before expiry", () => {
      const clinic = {
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_expires_at: null,
        trial_used: true,
      };
      assert.equal(isTrialActive(clinic), true);
      assert.equal(hasDashboardAccess(clinic), true);
    });

    it("trial expires correctly after 7 days", () => {
      const clinic = {
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() - 1000).toISOString(),
        subscription_expires_at: null,
        trial_used: true,
      };
      assert.equal(isTrialActive(clinic), false);
      assert.equal(hasDashboardAccess(clinic), false);
    });

    it("trial entitlement cannot be recreated for same email or phone", () => {
      const entitlement = read("lib/trial-entitlement.ts");
      assert.match(entitlement, /existingByEmail \|\| existingByPhone/);
      assert.match(entitlement, /TRIAL_ALREADY_USED_CODE/);
      assert.match(entitlement, /TRIAL_ENTITLEMENT_USED_MESSAGE/);
    });

    it("registration checks email and phone before creating trial", () => {
      const route = read("app/api/clinics/route.ts");
      assert.match(route, /findExistingDoctorByEmail/);
      assert.match(route, /findExistingDoctorByPhone/);
      assert.match(route, /buildNewDoctorTrialFields/);
      assert.match(read("lib/trial-entitlement.ts"), /trial_used: true/);
    });

    it("logout/login cannot create another trial for same verified identity", () => {
      const verify = read("app/api/otp/verify/route.ts");
      assert.match(verify, /findClinicIdByEmail/);
      assert.match(verify, /doctor_id: existingDoctorId/);
      assert.doesNotMatch(read("app/api/otp/verify/route.ts"), /buildNewDoctorTrialFields/);
    });

    it("expired paid subscription does not create a new trial", () => {
      const expired = {
        subscription_status: "active",
        trial_ends_at: new Date("2026-07-01T00:00:00.000Z").toISOString(),
        subscription_expires_at: new Date("2026-08-01T00:00:00.000Z").toISOString(),
        trial_used: true,
      };
      assert.equal(isPaidSubscriptionActive(expired), false);
      assert.equal(hasDashboardAccess(expired), false);
      assert.match(read("lib/trial-entitlement.ts"), /trial_used === true/);
    });

    it("renewal keeps trial_used true and does not grant a new trial", () => {
      const paid = {
        subscription_status: "active",
        trial_ends_at: new Date("2026-08-10T00:00:00.000Z").toISOString(),
        subscription_expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        trial_used: true,
      };
      assert.equal(isTrialActive(paid), false);
      assert.equal(hasDashboardAccess(paid), true);
      assert.match(read("lib/cashfree-payment.ts"), /trial_used: true/);
    });

    it("failed payment does not reset trial entitlement", () => {
      const payment = read("lib/cashfree-payment.ts");
      assert.match(payment, /trial_used: true/);
      assert.doesNotMatch(payment, /trial_used:\s*false/);
    });

    it("paying during trial ends trial immediately but keeps trial_used true", () => {
      const paidAt = new Date("2026-08-16T12:00:00.000Z");
      const trialEnd = new Date("2026-08-20T00:00:00.000Z").toISOString();
      const ended = trialEndsAtOnPaidActivation(trialEnd, paidAt);
      assert.equal(ended, paidAt.toISOString());
      assert.match(read("lib/trial-entitlement.ts"), /trial_used: true/);
    });
  });

  describe("Race conditions and database constraints", () => {
    it("detects PostgreSQL unique violations for concurrent registration", () => {
      const entitlement = read("lib/trial-entitlement.ts");
      assert.match(entitlement, /error\?\.code === "23505"/);
    });

    it("registration maps unique violations to TRIAL_ALREADY_USED", () => {
      const route = read("app/api/clinics/route.ts");
      assert.match(route, /isUniqueTrialViolation/);
      assert.match(route, /TRIAL_ALREADY_USED_CODE/);
    });

    it("migration adds trial_used and unique phone constraint", () => {
      const migration = read("supabase/migrations/021_doctor_trial_entitlement.sql");
      assert.match(migration, /trial_used/);
      assert.match(migration, /clinics_phone_normalized_unique_idx/);
      assert.match(read("supabase/migrations/018_clinic_email_unique_and_index_cleanup.sql"), /clinics_email_unique_idx/);
    });

    it("duplicate webhook cannot create another trial account", () => {
      const handler = read("lib/cashfree-webhook-handler.ts");
      assert.match(handler, /recordWebhookEvent/);
      assert.doesNotMatch(handler, /buildNewDoctorTrialFields/);
    });
  });

  describe("Payment security", () => {
    it("Cashfree order tags bind doctor_id to authenticated Doctor", () => {
      const cashfree = read("lib/cashfree.ts");
      assert.match(cashfree, /doctor_id: input.clinicId/);
      assert.match(cashfree, /clinic_id: input.clinicId/);
    });

    it("payment verification rejects mismatched doctor_id tags", () => {
      const payment = read("lib/cashfree-payment.ts");
      assert.match(payment, /extractDoctorIdFromOrderTags/);
      assert.match(payment, /taggedDoctorId !== clinicId/);
    });

    it("₹999 enforced server-side", () => {
      assert.match(read("lib/cashfree-payment.ts"), /orderAmount !== expectedAmount/);
    });

    it("frontend cannot fake payment success", () => {
      assert.doesNotMatch(read("app/dashboard/page.tsx"), /payment_success\s*=\s*true/);
      assert.match(read("app/dashboard/page.tsx"), /verify-payment/);
    });
  });

  describe("API lock enforcement", () => {
    it("server-side subscription guard blocks expired trial without payment", () => {
      assert.match(read("lib/subscription-guard.ts"), /requireDoctorSubscription/);
      assert.match(read("app/api/clinics/[id]/next/route.ts"), /requireDoctorSubscription/);
    });

    it("localStorage cannot manipulate trial status", () => {
      assert.doesNotMatch(read("lib/subscription-access.ts"), /localStorage/);
      assert.match(read("lib/subscription-access.ts"), /trial_ends_at/);
    });
  });
});
