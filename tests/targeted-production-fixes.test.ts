import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildSubscriptionWebhookEventId } from "../lib/subscription-webhook-id.ts";
import {
  isVercelCronJobPath,
  shouldRedirectToCanonicalHost,
} from "../lib/canonical-host.ts";

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

  describe("join page not found", () => {
    it("uses Next.js notFound for missing clinics on join route", () => {
      const page = read("app/join/[clinicId]/page.tsx");
      assert.match(page, /notFound\(\)/);
      assert.match(page, /getPublicClinicOrThrow/);
    });

    it("keeps join form in a client component", () => {
      const form = read("app/join/[clinicId]/join-form.tsx");
      assert.match(form, /"use client"/);
      assert.match(form, /Book Token/);
    });
  });

  describe("SEO canonical URLs", () => {
    it("does not set a global homepage canonical in root layout", () => {
      const layout = read("app/layout.tsx");
      assert.doesNotMatch(layout, /alternates:\s*\{[^}]*canonical:\s*"\//s);
    });

    it("sets per-page canonical on indexable public pages", () => {
      assert.match(read("app/page.tsx"), /canonical:\s*"\//);
      assert.match(read("app/privacy/page.tsx"), /canonical:\s*"\/privacy"/);
      assert.match(read("app/terms/page.tsx"), /canonical:\s*"\/terms"/);
      assert.match(
        read("app/refund-policy/page.tsx"),
        /canonical:\s*"\/refund-policy"/,
      );
      assert.match(read("app/contact/page.tsx"), /canonical:\s*"\/contact"/);
      assert.match(
        read("app/data-deletion/page.tsx"),
        /canonical:\s*"\/data-deletion"/,
      );
    });

    it("does not set canonical on private noindex layouts", () => {
      assert.doesNotMatch(read("app/login/layout.tsx"), /canonical/);
      assert.doesNotMatch(read("app/dashboard/layout.tsx"), /canonical/);
      assert.doesNotMatch(read("app/join/layout.tsx"), /canonical/);
    });
  });

  describe("vercel cron compatibility", () => {
    it("exposes GET handlers for scheduled job routes", () => {
      for (const route of [
        "app/api/jobs/confirmations/route.ts",
        "app/api/jobs/reconcile-subscriptions/route.ts",
        "app/api/reviews/send/route.ts",
      ]) {
        const source = read(route);
        assert.match(source, /export const GET = /);
        assert.match(source, /export const POST = /);
      }
    });

    it("rejects cron requests without CRON_SECRET", () => {
      const cronAuth = read("lib/auth/cron.ts");
      assert.match(cronAuth, /CRON_SECRET is not configured/);
      assert.match(cronAuth, /return false/);
      for (const route of [
        "app/api/jobs/confirmations/route.ts",
        "app/api/jobs/reconcile-subscriptions/route.ts",
        "app/api/reviews/send/route.ts",
      ]) {
        const source = read(route);
        assert.match(source, /isAuthorizedJobRequest/);
        assert.match(source, /status: 401/);
      }
    });

    it("defines production cron schedules in vercel.json", () => {
      const vercel = read("vercel.json");
      assert.match(vercel, /"path": "\/api\/jobs\/confirmations"/);
      assert.match(vercel, /"path": "\/api\/reviews\/send"/);
      assert.match(vercel, /"path": "\/api\/jobs\/reconcile-subscriptions"/);
    });

    it("does not canonical-redirect Vercel cron job API paths", () => {
      const middlewareSource = read("middleware.ts");
      assert.match(
        middlewareSource,
        /shouldRedirectToCanonicalHost\(host, cronPath\)/,
      );
      assert.match(middlewareSource, /NextResponse\.rewrite\(url\)/);

      const previousNodeEnv = process.env.NODE_ENV;
      const previousVercelEnv = process.env.VERCEL_ENV;
      process.env.NODE_ENV = "production";
      process.env.VERCEL_ENV = "production";

      try {
        assert.equal(
          isVercelCronJobPath("/api/jobs/reconcile-subscriptions"),
          true,
        );
        assert.equal(
          isVercelCronJobPath("/api/jobs/reconcile-subscriptions/"),
          true,
        );
        assert.equal(
          shouldRedirectToCanonicalHost(
            "skiplines-app.vercel.app",
            "/api/jobs/reconcile-subscriptions",
          ),
          false,
        );
        assert.equal(
          shouldRedirectToCanonicalHost(
            "skiplines.in",
            "/api/jobs/reconcile-subscriptions",
          ),
          false,
        );
        assert.equal(
          shouldRedirectToCanonicalHost("skiplines-app.vercel.app", "/dashboard"),
          true,
        );
        assert.equal(
          shouldRedirectToCanonicalHost("skiplines.in", "/dashboard"),
          true,
        );
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
        process.env.VERCEL_ENV = previousVercelEnv;
      }
    });

    it("does not use next.config host redirects for cron paths", () => {
      const nextConfig = read("next.config.ts");
      assert.doesNotMatch(nextConfig, /async redirects\(/);
      assert.doesNotMatch(nextConfig, /skiplines-app\.vercel\.app/);
      assert.doesNotMatch(nextConfig, /skiplines\.in/);
      assert.match(nextConfig, /skipTrailingSlashRedirect:\s*true/);
    });

    it("rewrites trailing-slash cron paths in vercel.json", () => {
      const vercel = read("vercel.json");
      assert.match(
        vercel,
        /"source": "\/api\/jobs\/reconcile-subscriptions\/"/,
      );
      assert.match(
        vercel,
        /"destination": "\/api\/jobs\/reconcile-subscriptions"/,
      );
    });
  });

  describe("OTP send privacy", () => {
    it("does not leak whether an email is already registered", () => {
      const route = read("app/api/otp/send/route.ts");
      assert.doesNotMatch(route, /login:\s*isLogin/);
      assert.doesNotMatch(route, /findExistingClinicByEmail/);
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

    it("retries PG activation on duplicate webhook delivery", () => {
      const handler = read("lib/cashfree-webhook-handler.ts");
      assert.match(handler, /pgActivationResponse\(result, recordResult\.kind === "duplicate"\)/);
      assert.match(handler, /activateFromWebhookOrder\(orderId\)/);
    });

    it("returns 500 when PG activation or webhook recording fails", () => {
      const handler = read("lib/cashfree-webhook-handler.ts");
      assert.match(handler, /recordWebhookEventDeduped/);
      assert.match(handler, /status: 500/);
      assert.match(handler, /pgActivationResponse/);
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
