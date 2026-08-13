import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildCallNextTemplatePayload,
  buildCallNextTextBody,
  CALL_NEXT_NOTIFICATION_TYPE,
  CALL_NEXT_PENDING_MESSAGE,
  notifyCallNextPatient,
} from "../lib/whatsapp-call-next.ts";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("Call Next WhatsApp notifications", () => {
  it("normalizes Indian phones for WhatsApp Cloud API without double 91 prefix", () => {
    const tenDigit = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
      liveTrackerUrl: "https://www.skiplines.in/live/a",
    });
    const plusPrefix = buildCallNextTemplatePayload({
      to: "+91 98765 43210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
      liveTrackerUrl: "https://www.skiplines.in/live/a",
    });
    const twelveDigit = buildCallNextTemplatePayload({
      to: "919876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
      liveTrackerUrl: "https://www.skiplines.in/live/a",
    });

    assert.equal(tenDigit.to, "919876543210");
    assert.equal(plusPrefix.to, "919876543210");
    assert.equal(twelveDigit.to, "919876543210");
    assert.notEqual(tenDigit.to, "9191876543210");
  });

  it("builds template payload with token number and live tracker URL", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      liveTrackerUrl: "https://www.skiplines.in/live/token-uuid",
    });

    assert.equal(payload.to, "919876543210");
    assert.equal(payload.type, "template");
    assert.equal(payload.template.name, "patient_called");
    assert.equal(payload.template.language.code, "en");
    assert.equal(payload.template.components[0].parameters[0].text, "5");
    assert.equal(
      payload.template.components[0].parameters[1].text,
      "https://www.skiplines.in/live/token-uuid",
    );
  });

  it("uses patient_phone as the WhatsApp destination in template payload", () => {
    const tenDigit = buildCallNextTemplatePayload({
      to: "6123456789",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 12,
      liveTrackerUrl: "https://www.skiplines.in/live/abc",
    });
    const twelveDigit = buildCallNextTemplatePayload({
      to: "916123456789",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 12,
      liveTrackerUrl: "https://www.skiplines.in/live/abc",
    });

    assert.equal(tenDigit.to, "916123456789");
    assert.equal(twelveDigit.to, "916123456789");
  });

  it("includes doctor-ready wording in dev text fallback body", () => {
    const body = buildCallNextTextBody(
      5,
      "https://www.skiplines.in/live/token-uuid",
    );
    assert.match(body, /Token #5/);
    assert.match(body, /doctor is ready/i);
  });

  it("notifyCallNextPatient returns false without throwing when credentials are missing", async () => {
    const previousToken = process.env.WHATSAPP_TOKEN;
    const previousPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const previousNode = process.env.NODE_ENV;
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.NODE_ENV = "test";

    try {
      const result = await notifyCallNextPatient({
        clinicId: "clinic-1",
        tokenId: "token-1",
        patientPhone: "9876543210",
        tokenNumber: 5,
      });
      assert.equal(result, false);
    } finally {
      process.env.WHATSAPP_TOKEN = previousToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhoneId;
      process.env.NODE_ENV = previousNode;
    }
  });

  it("notifyCallNextPatient returns false without throwing when Meta API fails", async () => {
    const previousToken = process.env.WHATSAPP_TOKEN;
    const previousPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const previousTemplate = process.env.WHATSAPP_CALL_NEXT_TEMPLATE;
    const previousNode = process.env.NODE_ENV;
    const originalFetch = global.fetch;

    process.env.WHATSAPP_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
    process.env.WHATSAPP_CALL_NEXT_TEMPLATE = "patient_called";
    process.env.NODE_ENV = "test";

    global.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "failed" } }), {
        status: 500,
      });

    try {
      const result = await notifyCallNextPatient({
        clinicId: "clinic-1",
        tokenId: "token-meta-fail",
        patientPhone: "9876543210",
        tokenNumber: 5,
      });
      assert.equal(result, false);
    } finally {
      global.fetch = originalFetch;
      process.env.WHATSAPP_TOKEN = previousToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhoneId;
      process.env.WHATSAPP_CALL_NEXT_TEMPLATE = previousTemplate;
      process.env.NODE_ENV = previousNode;
    }
  });

  it("claims notification_logs before sending for race-safe idempotency", () => {
    const source = read("lib/whatsapp-call-next.ts");
    const claimIndex = source.indexOf("claimCallNextNotificationSlot");
    const sendIndex = source.indexOf("postWhatsAppMessage(outboundPayload)");
    assert.ok(claimIndex >= 0);
    assert.ok(sendIndex > claimIndex);
    assert.match(source, /isUniqueViolationError/);
    assert.match(source, /already sent/);
    assert.equal(CALL_NEXT_PENDING_MESSAGE, "call-next:pending");
  });

  it("defines a partial unique index for one called notification per token", () => {
    const migration = read(
      "supabase/migrations/020_call_next_notification_idempotency.sql",
    );
    assert.match(migration, /create unique index if not exists notification_logs_called_token_unique/i);
    assert.match(migration, /type = 'called'/);
  });

  it("Call Next route never depends on WhatsApp success", () => {
    const route = read("app/api/clinics/[id]/next/route.ts");
    assert.match(route, /notifyCallNextPatient/);
    assert.doesNotMatch(route, /if\s*\(\s*await notifyCallNextPatient/);
    assert.match(route, /return NextResponse\.json\(\{ patient: called \}\)/);
  });

  it("does not log WhatsApp access tokens in call-next module", () => {
    const source = read("lib/whatsapp-call-next.ts");
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*token[^)]*Bearer/i);
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*WHATSAPP_TOKEN/i);
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*patientPhone/i);
  });

  it("exports call-next notification type used for idempotency", () => {
    assert.equal(CALL_NEXT_NOTIFICATION_TYPE, "called");
  });
});
