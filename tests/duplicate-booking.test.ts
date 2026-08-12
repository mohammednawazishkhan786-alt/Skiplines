import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { normalizePhone } from "../lib/phone.ts";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function normalizeQueuePatientPhone(phone?: string | null): string | null {
  if (phone === undefined || phone === null) {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  return normalizePhone(trimmed);
}

function isExistingQueueEntry(
  entry: { id: string; created_at: string },
  requestedAtMs: number,
  preExisting: { id: string } | null,
): boolean {
  if (preExisting && preExisting.id === entry.id) {
    return true;
  }

  return new Date(entry.created_at).getTime() < requestedAtMs - 100;
}

describe("duplicate booking protection", () => {
  describe("central phone normalization", () => {
    it("normalizes queue patient phones via normalizePhone", () => {
      assert.equal(normalizeQueuePatientPhone("+91 98765 43210"), "9876543210");
      assert.equal(normalizeQueuePatientPhone("919876543210"), "9876543210");
      assert.equal(normalizeQueuePatientPhone("  9876543210  "), "9876543210");
    });

    it("maps empty or missing phones to null without guessing", () => {
      assert.equal(normalizeQueuePatientPhone(""), null);
      assert.equal(normalizeQueuePatientPhone("   "), null);
      assert.equal(normalizeQueuePatientPhone(undefined), null);
      assert.equal(normalizeQueuePatientPhone(null), null);
    });

    it("uses normalizeQueuePatientPhone inside createQueueEntry", () => {
      const queue = read("lib/queue.ts");
      assert.match(queue, /export function normalizeQueuePatientPhone/);
      assert.match(queue, /normalizeQueuePatientPhone\(options\.patientPhone\)/);
      assert.match(queue, /from "@\/lib\/phone"/);
      assert.doesNotMatch(queue, /function normalizePhone\(/);
    });
  });

  describe("existing token detection", () => {
    const entry = {
      id: "token-a",
      created_at: "2026-08-10T10:00:00.000Z",
    };

    it("treats a pre-existing waiting token as existing", () => {
      assert.equal(
        isExistingQueueEntry(entry, Date.now(), { id: "token-a" }),
        true,
      );
    });

    it("treats a token created before this request as existing", () => {
      assert.equal(
        isExistingQueueEntry(entry, Date.parse("2026-08-10T10:00:01.000Z"), null),
        true,
      );
    });

    it("treats a token created during this request as new", () => {
      const requestedAt = Date.parse("2026-08-10T10:00:00.000Z");
      assert.equal(
        isExistingQueueEntry(
          { id: "token-b", created_at: "2026-08-10T10:00:00.050Z" },
          requestedAt,
          null,
        ),
        false,
      );
    });
  });

  describe("application dedup contracts", () => {
    it("checks for an existing waiting token before RPC and legacy insert", () => {
      const queue = read("lib/queue.ts");
      assert.match(queue, /findWaitingTokenByPhone/);
      assert.match(queue, /preExistingBeforeRpc/);
      assert.match(queue, /existing: true/);
    });

    it("recovers from unique violations without surfacing HTTP 500", () => {
      const queue = read("lib/queue.ts");
      assert.match(queue, /isUniqueViolationError/);
      assert.match(queue, /const recovered = await findWaitingTokenByPhone/);
    });

    it("returns existing waiting tokens from join API with compatible shape", () => {
      const joinRoute = read("app/api/clinics/[id]/join/route.ts");
      assert.match(joinRoute, /const \{ entry, existing \} = await createQueueEntry/);
      assert.match(joinRoute, /toPublicToken\(entry\)/);
      assert.match(joinRoute, /status: existing \? 200 : 201/);
    });

    it("keeps WhatsApp on createQueueEntry with duplicate-safe messaging", () => {
      const webhook = read("app/api/whatsapp/webhook/route.ts");
      assert.match(webhook, /const \{ entry: queueEntry, existing \}/);
      assert.match(webhook, /You already have Token #/);
      assert.match(webhook, /createQueueEntry/);
    });
  });

  describe("migration 019 database protection", () => {
    const migration = read(
      "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
    );

    it("creates a partial unique index for waiting tokens with phones", () => {
      assert.match(
        migration,
        /create unique index if not exists tokens_one_waiting_per_phone_per_clinic/,
      );
      assert.match(migration, /where status = 'waiting' and patient_phone is not null/);
    });

    it("aborts when normalized duplicate waiting groups already exist", () => {
      assert.match(migration, /v_duplicate_groups/);
      assert.match(migration, /having count\(\*\) > 1/);
      assert.match(migration, /raise exception/);
    });

    it("does not delete or bulk-update existing token rows in the migration", () => {
      assert.match(migration, /Does NOT modify or delete existing rows/);
      assert.doesNotMatch(migration, /delete\s+from\s+public\.tokens/i);
      assert.doesNotMatch(
        migration,
        /update\s+public\.tokens\s+set\s+status\s*=\s*'completed'/i,
      );
    });

    it("returns an existing waiting token inside join_queue_atomic", () => {
      assert.match(migration, /and status = 'waiting'/);
      assert.match(migration, /if found then\s+return v_entry;/);
      assert.match(migration, /pg_advisory_xact_lock/);
    });
  });

  describe("approved booking rules", () => {
    it("allows only one waiting token per normalized phone per clinic at the DB layer", () => {
      const migration = read(
        "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
      );
      assert.match(migration, /tokens_one_waiting_per_phone_per_clinic/);
      assert.match(migration, /\(clinic_id, patient_phone\)/);
      assert.match(migration, /status = 'waiting'/);
    });

    it("documents that completed or called tokens do not block a new waiting booking", () => {
      const migration = read(
        "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
      );
      const queue = read("lib/queue.ts");
      assert.match(migration, /status = 'waiting'/);
      assert.doesNotMatch(queue, /status.*completed.*findWaitingTokenByPhone/s);
    });

    it("keeps NULL-phone waiting tokens outside the unique index scope", () => {
      const migration = read(
        "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
      );
      const queue = read("lib/queue.ts");
      assert.match(migration, /patient_phone is not null/);
      assert.match(queue, /normalizeQueuePatientPhone\(options\.patientPhone\)/);
    });

    it("preserves emergency=false and existing queue numbering paths", () => {
      const migration = read(
        "supabase/migrations/019_tokens_one_waiting_per_phone.sql",
      );
      assert.match(migration, /p_is_emergency/);
      assert.match(migration, /max\(token_number\)/);
      assert.match(migration, /max\(queue_position\)/);
    });
  });
});
