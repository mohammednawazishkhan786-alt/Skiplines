import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Documents expected concurrency properties of migration 017 RPCs.
 * Live DB race tests require service-role credentials and are out of band.
 */
describe("queue concurrency contracts", () => {
  it("defines atomic join RPC name used by application code", async () => {
    const { readFileSync } = await import("node:fs");
    const queue = readFileSync("lib/queue.ts", "utf8");
    assert.match(queue, /join_queue_atomic/);
    assert.match(queue, /createQueueEntryLegacy/);
  });

  it("defines atomic call-next RPC in doctor next route", async () => {
    const { readFileSync } = await import("node:fs");
    const nextRoute = readFileSync("app/api/clinics/[id]/next/route.ts", "utf8");
    assert.match(nextRoute, /call_next_patient_atomic/);
    assert.match(nextRoute, /status", "waiting"/);
  });

  it("migration 017 grants RPC only to service_role", async () => {
    const { readFileSync } = await import("node:fs");
    const migration = readFileSync(
      "supabase/migrations/017_queue_concurrency_and_indexes.sql",
      "utf8",
    );
    assert.match(migration, /tokens_clinic_id_status_idx/);
    assert.match(migration, /grant execute[\s\S]*service_role/);
    assert.match(migration, /revoke all[\s\S]*anon, authenticated/);
    assert.match(migration, /pg_advisory_xact_lock/);
  });

  it("migration 019 enforces one waiting token per phone per clinic", async () => {
    const { readFileSync } = await import("node:fs");
    const migration = readFileSync(
      "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
      "utf8",
    );
    assert.match(migration, /tokens_one_waiting_per_phone_per_clinic/);
    assert.match(migration, /if found then\s+return v_entry;/);
  });
});
