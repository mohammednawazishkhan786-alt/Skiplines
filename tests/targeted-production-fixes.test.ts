import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildSubscriptionWebhookEventId } from "../lib/subscription-webhook-id.ts";

const root = join(import.meta.dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("targeted production fixes", () => {
  describe("emergency feature removed", () => {
    it("does not expose patient or doctor emergency API routes", () => {
      assert.equal(
        existsSync(join(root, "app/api/queue/[tokenId]/emergency/route.ts")),
        false,
      );
      assert.equal(
        existsSync(join(root, "app/api/clinics/[id]/emergency/route.ts")),
        false,
      );
    });
  });

  describe("public join has no emergency input", () => {
    it("does not read or pass emergency flags", () => {
      const route = read("app/api/clinics/[id]/join/route.ts");
      assert.doesNotMatch(route, /is_emergency/);
      assert.doesNotMatch(route, /isEmergency/);
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
