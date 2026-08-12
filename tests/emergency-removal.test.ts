import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function pathExists(rel: string) {
  return existsSync(join(root, rel));
}

describe("emergency feature removal", () => {
  describe("API routes removed", () => {
    it("does not expose patient emergency endpoint", () => {
      assert.equal(
        pathExists("app/api/queue/[tokenId]/emergency/route.ts"),
        false,
      );
    });

    it("does not expose doctor emergency endpoint", () => {
      assert.equal(
        pathExists("app/api/clinics/[id]/emergency/route.ts"),
        false,
      );
    });
  });

  describe("queue library", () => {
    it("does not export promoteEmergencyToken", () => {
      const queue = read("lib/queue.ts");
      assert.doesNotMatch(queue, /promoteEmergencyToken/);
      assert.doesNotMatch(queue, /isEmergency/);
    });

    it("always passes false to join_queue_atomic RPC", () => {
      const queue = read("lib/queue.ts");
      assert.match(queue, /p_is_emergency:\s*false/);
    });
  });

  describe("public join", () => {
    it("does not accept client emergency flags", () => {
      const route = read("app/api/clinics/[id]/join/route.ts");
      assert.doesNotMatch(route, /is_emergency/);
      assert.doesNotMatch(route, /isEmergency/);
      assert.match(route, /createQueueEntry/);
    });
  });

  describe("WhatsApp", () => {
    it("does not create emergency tokens from messages", () => {
      const route = read("app/api/whatsapp/webhook/route.ts");
      assert.doesNotMatch(route, /EMERGENCY/i);
      assert.doesNotMatch(route, /isEmergency/);
      assert.doesNotMatch(route, /emergency_token/);
      assert.match(route, /createQueueEntry/);
    });
  });

  describe("patient live tracker UI", () => {
    it("removes emergency button and handler", () => {
      const page = read("app/live/[token_id]/page.tsx");
      assert.doesNotMatch(page, /emergency/i);
      assert.doesNotMatch(page, /AlertTriangle/);
      assert.match(page, /Live Queue Tracker/);
      assert.match(page, /handleLateShift/);
    });
  });

  describe("doctor dashboard UI", () => {
    it("removes emergency controls from waiting queue", () => {
      const page = read("app/dashboard/page.tsx");
      assert.doesNotMatch(page, /\/emergency/);
      assert.doesNotMatch(page, /handleEmergency/);
      assert.doesNotMatch(page, /AlertTriangle/);
      assert.match(page, /CALL NEXT PATIENT/);
    });
  });

  describe("AI receptionist prompt", () => {
    it("does not mention emergency commands", () => {
      const openai = read("lib/openai.ts");
      assert.doesNotMatch(openai, /EMERGENCY/i);
    });
  });

  describe("legal copy", () => {
    it("does not mention emergency tokens in refund policy", () => {
      const page = read("app/refund-policy/page.tsx");
      assert.doesNotMatch(page, /emergency/i);
    });
  });

  describe("normal queue flows preserved", () => {
    it("keeps public join route", () => {
      assert.equal(pathExists("app/api/clinics/[id]/join/route.ts"), true);
    });

    it("keeps live tracker queue fetch", () => {
      const page = read("app/live/[token_id]/page.tsx");
      assert.match(page, /\/api\/queue\/\$\{tokenId\}/);
    });

    it("keeps late shift endpoint for patients", () => {
      assert.equal(pathExists("app/api/queue/[tokenId]/late/route.ts"), true);
    });

    it("keeps doctor call-next endpoint", () => {
      assert.equal(pathExists("app/api/clinics/[id]/next/route.ts"), true);
    });
  });
});
