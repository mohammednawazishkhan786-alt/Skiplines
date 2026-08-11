import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyClinicOwnership } from "../lib/clinic-identity.ts";
import {
  buildCanonicalRedirectUrl,
  isVercelAppHost,
  shouldRedirectToCanonicalHost,
} from "../lib/canonical-host.ts";
import {
  CANONICAL_PRODUCTION_SITE_URL,
  getCanonicalSiteUrl,
} from "../lib/env.ts";
import { toPublicClinic } from "../lib/public-clinic.ts";
import {
  CLINIC_ID_MAX_INSERT_ATTEMPTS,
  generateSecureClinicId,
  insertClinicWithUniqueId,
  isUniqueViolationError,
  POSTGRES_UNIQUE_VIOLATION,
} from "../lib/clinic-registration.ts";

const CLINIC_A = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";
const CLINIC_B = "9376eb65-e3e9-4142-a54b-a6f4c0d449ad";
const PRODUCTION_BASE = "https://www.skiplines.in";

describe("clinic_id uniqueness", () => {
  it("generates cryptographically random UUID clinic IDs", () => {
    const first = generateSecureClinicId();
    const second = generateSecureClinicId();

    assert.notEqual(first, second);
    assert.match(
      first,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("never assigns the same clinic_id to two clinics across many generations", () => {
    const seen = new Set<string>();

    for (let index = 0; index < 1000; index += 1) {
      const clinicId = generateSecureClinicId();
      assert.equal(seen.has(clinicId), false);
      seen.add(clinicId);
    }
  });

  it("detects PostgreSQL unique-violation errors", () => {
    assert.equal(isUniqueViolationError({ code: POSTGRES_UNIQUE_VIOLATION }), true);
    assert.equal(isUniqueViolationError({ code: "23503" }), false);
    assert.equal(isUniqueViolationError(null), false);
  });

  it("retries with a new secure clinic_id after a unique collision", async () => {
    const attemptedIds: string[] = [];
    let calls = 0;

    const result = await insertClinicWithUniqueId(
      async (clinicId) => {
        attemptedIds.push(clinicId);
        calls += 1;

        if (calls === 1) {
          return {
            data: null,
            error: {
              code: POSTGRES_UNIQUE_VIOLATION,
              message: "duplicate key value violates unique constraint",
            },
          };
        }

        return {
          data: { id: clinicId, clinic_name: "Retry Clinic" },
          error: null,
        };
      },
      { clinic_name: "Retry Clinic" },
      CLINIC_ID_MAX_INSERT_ATTEMPTS,
    );

    assert.equal(calls, 2);
    assert.equal(attemptedIds.length, 2);
    assert.notEqual(attemptedIds[0], attemptedIds[1]);
    assert.equal(result.error, null);
    assert.equal(result.clinicId, attemptedIds[1]);
    assert.equal(result.data?.id, attemptedIds[1]);
  });

  it("never overwrites an existing clinic_id on collision", async () => {
    const existingId = CLINIC_A;
    let insertPayloadId: string | null = null;

    const result = await insertClinicWithUniqueId(
      async (clinicId) => {
        insertPayloadId = clinicId;
        return {
          data: null,
          error: {
            code: POSTGRES_UNIQUE_VIOLATION,
            message: "duplicate key value violates unique constraint",
          },
        };
      },
      { clinic_name: "Collision Clinic" },
      2,
    );

    assert.notEqual(insertPayloadId, existingId);
    assert.equal(result.data, null);
    assert.notEqual(result.clinicId, existingId);
  });

  it("builds different QR URLs for different clinic IDs", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercelEnv = process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    try {
      const urlA = `${getCanonicalSiteUrl()}/clinic/${CLINIC_A}`;
      const urlB = `${getCanonicalSiteUrl()}/clinic/${CLINIC_B}`;

      assert.equal(urlA, `${PRODUCTION_BASE}/clinic/${CLINIC_A}`);
      assert.equal(urlB, `${PRODUCTION_BASE}/clinic/${CLINIC_B}`);
      assert.notEqual(urlA, urlB);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });

  it("verifies clinic ownership before QR display", () => {
    assert.equal(verifyClinicOwnership(CLINIC_A, CLINIC_A), true);
    assert.equal(verifyClinicOwnership(CLINIC_A, CLINIC_B), false);
    assert.equal(verifyClinicOwnership(null, CLINIC_A), false);
    assert.equal(verifyClinicOwnership("not-a-uuid", CLINIC_A), false);
  });

  it("uses canonical production domain instead of vercel.app URLs", () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercelEnv = process.env.VERCEL_ENV;

    process.env.NEXT_PUBLIC_APP_URL = "https://skiplines-app.vercel.app";
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";

    try {
      assert.equal(getCanonicalSiteUrl(), CANONICAL_PRODUCTION_SITE_URL);
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      process.env.NODE_ENV = previousNodeEnv;
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  });

  it("detects vercel.app hosts for canonical redirect", () => {
    assert.equal(isVercelAppHost("skiplines-app.vercel.app"), true);
    assert.equal(
      isVercelAppHost("skiplines-7zsr0cau8-nawazish-khans-projects.vercel.app"),
      true,
    );
    assert.equal(isVercelAppHost("www.skiplines.in"), false);
    assert.equal(isVercelAppHost("skiplines.in"), false);
  });

  it("builds canonical redirect URLs for vercel.app traffic", () => {
    const destination = buildCanonicalRedirectUrl(
      "/clinic/adda7e3d-70bb-4c40-8ef9-42740b9f1762",
      "",
    );

    assert.equal(
      destination.toString(),
      "https://www.skiplines.in/clinic/adda7e3d-70bb-4c40-8ef9-42740b9f1762",
    );
  });

  it("builds canonical patient and live tracker URLs", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercelEnv = process.env.VERCEL_ENV;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = PRODUCTION_BASE;

    try {
      assert.equal(
        `${getCanonicalSiteUrl()}/clinic/${CLINIC_A}`,
        `${PRODUCTION_BASE}/clinic/${CLINIC_A}`,
      );
      assert.equal(
        `${getCanonicalSiteUrl()}/live/token-123`,
        `${PRODUCTION_BASE}/live/token-123`,
      );
      assert.equal(
        shouldRedirectToCanonicalHost("skiplines-app.vercel.app"),
        true,
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.VERCEL_ENV = previousVercelEnv;
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });

  it("strips private clinic fields from public patient responses", () => {
    const sanitized = toPublicClinic({
      id: CLINIC_A,
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
      subscription_status: "active",
      trial_ends_at: null,
      created_at: new Date().toISOString(),
    });

    assert.equal(sanitized.clinic_name, "Test Clinic");
    assert.equal("email" in sanitized, false);
    assert.equal("phone" in sanitized, false);
    assert.equal("subscription_status" in sanitized, false);
  });
});
