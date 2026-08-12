import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createDoctorToken,
  verifyDoctorAuth,
} from "../lib/auth/doctor-token.ts";
import { buildSubscriptionWebhookEventId } from "../lib/subscription-webhook-id.ts";

const root = join(import.meta.dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const CLINIC_A = "adda7e3d-70bb-4c40-8ef9-42740b9f1762";
const CLINIC_B = "9376eb65-e3e9-4142-a54b-a6f4c0d449ad";

function withDoctorSecret<T>(fn: () => T) {
  const previous = process.env.DOCTOR_AUTH_SECRET;
  process.env.DOCTOR_AUTH_SECRET = "test_doctor_auth_secret_for_unit_tests_32";
  try {
    return fn();
  } finally {
    process.env.DOCTOR_AUTH_SECRET = previous;
  }
}

describe("targeted production fixes", () => {
  describe("patient queue emergency auth", () => {
    it("requires doctor subscription guard in queue emergency route", () => {
      const route = read("app/api/queue/[tokenId]/emergency/route.ts");
      assert.match(route, /requireDoctorSubscription/);
      assert.doesNotMatch(route, /getSubscriptionAccessError/);
    });

    it("rejects unauthenticated doctor access", () => {
      withDoctorSecret(() => {
        const request = new Request(
          "https://www.skiplines.in/api/queue/token/emergency",
        );
        assert.equal(verifyDoctorAuth(request, CLINIC_A), false);
      });
    });

    it("rejects wrong-clinic doctor access", () => {
      withDoctorSecret(() => {
        const token = createDoctorToken(CLINIC_A);
        const request = new Request(
          "https://www.skiplines.in/api/queue/token/emergency",
          {
            headers: { cookie: `doctor_token=${encodeURIComponent(token)}` },
          },
        );
        assert.equal(verifyDoctorAuth(request, CLINIC_B), false);
        assert.equal(verifyDoctorAuth(request, CLINIC_A), true);
      });
    });
  });

  describe("public join emergency flag", () => {
    it("forces isEmergency false and ignores client is_emergency", () => {
      const route = read("app/api/clinics/[id]/join/route.ts");
      assert.match(route, /isEmergency:\s*false/);
      assert.doesNotMatch(route, /body\.is_emergency/);
    });
  });

  describe("clinic page not found", () => {
    it("uses Next.js notFound for missing clinics", () => {
      const page = read("app/clinic/[clinicId]/page.tsx");
      assert.match(page, /notFound\(\)/);
      assert.doesNotMatch(page, /Clinic not found/);
    });
  });

  describe("subscription webhook idempotency", () => {
    it("builds stable event ids for identical webhook bodies", () => {
      const body = JSON.stringify({ type: "SUBSCRIPTION_CHARGED", data: {} });
      const first = buildSubscriptionWebhookEventId("SUBSCRIPTION_CHARGED", body);
      const second = buildSubscriptionWebhookEventId("SUBSCRIPTION_CHARGED", body);
      assert.equal(first, second);
      assert.match(first, /^SUBSCRIPTION_CHARGED:[a-f0-9]{32}$/);
    });

    it("prefers explicit Cashfree event_id when provided", () => {
      const body = JSON.stringify({ type: "SUBSCRIPTION_ACTIVE" });
      const id = buildSubscriptionWebhookEventId(
        "SUBSCRIPTION_ACTIVE",
        body,
        "evt_cf_123",
      );
      assert.equal(id, "evt_cf_123");
    });

    it("records subscription webhook idempotency in handler", () => {
      const handler = read("lib/cashfree-webhook-handler.ts");
      assert.match(handler, /buildSubscriptionWebhookEventId/);
      assert.match(handler, /recordWebhookEvent/);
      assert.match(handler, /status: "duplicate"/);
    });

    it("rejects invalid webhook signatures before processing", () => {
      const handler = read("lib/cashfree-webhook-handler.ts");
      assert.match(handler, /verifyCashfreeWebhook/);
      assert.match(handler, /Invalid webhook signature/);
      assert.match(handler, /status: 401/);
    });
  });

  describe("SEO title duplication", () => {
    it("uses short child titles compatible with root template", () => {
      assert.match(read("app/login/layout.tsx"), /title: "Doctor Login"/);
      assert.match(read("app/register/layout.tsx"), /title: "Doctor Registration"/);
      assert.match(read("app/dashboard/layout.tsx"), /title: "Dashboard"/);
      assert.doesNotMatch(read("app/login/layout.tsx"), /Doctor Login — Skiplines/);
    });

    it("keeps homepage absolute title without template suffix", () => {
      const home = read("app/page.tsx");
      assert.match(home, /absolute: "Skiplines — Skip the Wait"/);
    });
  });

  describe("clinic email unique migration", () => {
    it("defines clinics_email_unique_idx on normalized email", () => {
      const migration = read(
        "supabase/migrations/018_clinic_email_unique_and_index_cleanup.sql",
      );
      assert.match(migration, /clinics_email_unique_idx/);
      assert.match(migration, /lower\(trim\(email\)\)/);
    });
  });

  describe("duplicate index cleanup", () => {
    it("scopes migration 018 to clinic email uniqueness without dropping indexes", () => {
      const migration = read(
        "supabase/migrations/018_clinic_email_unique_and_index_cleanup.sql",
      );
      assert.match(migration, /clinics_email_unique_idx/);
      assert.match(migration, /lower\(trim\(email\)\)/);
      assert.doesNotMatch(migration, /drop index/i);
      assert.doesNotMatch(migration, /tokens_clinic_status_idx/i);
    });
  });
});
