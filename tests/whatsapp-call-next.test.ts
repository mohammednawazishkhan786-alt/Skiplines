import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildCallNextTemplatePayload,
  buildCallNextTextBody,
  CALL_NEXT_NOTIFICATION_TYPE,
  CALL_NEXT_PENDING_MESSAGE,
  formatMetaErrorForLog,
  getWhatsAppCallNextTemplateBodyParams,
  notifyCallNextPatient,
  parseMetaErrorResponse,
  postWhatsAppTemplateMessage,
  sanitizeMetaDiagnostic,
} from "../lib/whatsapp-call-next.ts";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function mockMetaFetch(status: number, body: unknown) {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify(body), { status });
  return () => {
    global.fetch = originalFetch;
  };
}

function withWhatsAppEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void> | void,
) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return Promise.resolve(run()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("Call Next WhatsApp notifications", () => {
  it("normalizes Indian phones for WhatsApp Cloud API without double 91 prefix", () => {
    const tenDigit = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
    });
    const plusPrefix = buildCallNextTemplatePayload({
      to: "+91 98765 43210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
    });
    const twelveDigit = buildCallNextTemplatePayload({
      to: "919876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 1,
    });

    assert.equal(tenDigit.to, "919876543210");
    assert.equal(plusPrefix.to, "919876543210");
    assert.equal(twelveDigit.to, "919876543210");
    assert.notEqual(tenDigit.to, "9191876543210");
  });

  it("builds template payload with correct name, language, and one body parameter when configured", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      bodyParams: ["token"],
    });

    assert.equal(payload.to, "919876543210");
    assert.equal(payload.type, "template");
    assert.equal(payload.template.name, "patient_called");
    assert.equal(payload.template.language.code, "en");
    assert.equal(payload.template.components[0].parameters.length, 1);
    assert.equal(payload.template.components[0].parameters[0].text, "5");
  });

  it("supports patient name as the first template body parameter when configured", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      patientName: "Rahul Kumar",
      liveTrackerUrl: "https://www.skiplines.in/live/token-uuid",
      bodyParams: ["name", "token", "tracker"],
    });

    assert.equal(payload.template.components[0].parameters.length, 3);
    assert.equal(payload.template.components[0].parameters[0].text, "Rahul Kumar");
    assert.equal(payload.template.components[0].parameters[1].text, "5");
    assert.equal(
      payload.template.components[0].parameters[2].text,
      "https://www.skiplines.in/live/token-uuid",
    );
  });

  it("falls back to Patient when name is missing from template payload", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      bodyParams: ["name", "token"],
    });

    assert.equal(payload.template.components[0].parameters[0].text, "Patient");
  });

  it("supports token and tracker body parameters by default", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      liveTrackerUrl: "https://www.skiplines.in/live/token-uuid",
      bodyParams: ["token", "tracker"],
    });

    assert.equal(payload.template.components[0].parameters.length, 2);
    assert.equal(payload.template.components[0].parameters[0].text, "5");
    assert.equal(
      payload.template.components[0].parameters[1].text,
      "https://www.skiplines.in/live/token-uuid",
    );
  });

  it("omits body components when template has zero variables", () => {
    const payload = buildCallNextTemplatePayload({
      to: "9876543210",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 5,
      bodyParams: [],
    });

    assert.equal(payload.template.components, undefined);
  });

  it("reads body param config from WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS", () => {
    const previous = process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS;
    process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS = "token,tracker";
    try {
      assert.deepEqual(getWhatsAppCallNextTemplateBodyParams(), [
        "token",
        "tracker",
      ]);
    } finally {
      process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS = previous;
    }
  });

  it("defaults body params to token and tracker", () => {
    const previous = process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS;
    delete process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS;
    try {
      assert.deepEqual(getWhatsAppCallNextTemplateBodyParams(), [
        "token",
        "tracker",
      ]);
    } finally {
      process.env.WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS = previous;
    }
  });

  it("uses patient_phone as the WhatsApp destination in template payload", () => {
    const tenDigit = buildCallNextTemplatePayload({
      to: "6123456789",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 12,
      bodyParams: ["token"],
    });
    const twelveDigit = buildCallNextTemplatePayload({
      to: "916123456789",
      templateName: "patient_called",
      languageCode: "en",
      tokenNumber: 12,
      bodyParams: ["token"],
    });

    assert.equal(tenDigit.to, "916123456789");
    assert.equal(twelveDigit.to, "916123456789");
  });

  it("uses Hindi your-turn wording with patient name in dev text fallback body", () => {
    const body = buildCallNextTextBody(5, "Rahul");
    assert.match(body, /Skiplines/);
    assert.match(body, /Hi Rahul/);
    assert.match(body, /aapki baari aa gayi hai/i);
    assert.match(body, /Kripya doctor ke paas jaiye/);
    assert.match(body, /Token: #5/);
  });

  it("notifyCallNextPatient returns false without throwing when patient phone is missing", async () => {
    const result = await notifyCallNextPatient({
      clinicId: "clinic-1",
      tokenId: "token-no-phone",
      patientPhone: "   ",
      tokenNumber: 3,
    });
    assert.equal(result, false);
  });

  it("notifyCallNextPatient returns false without throwing when credentials are missing", async () => {
    await withWhatsAppEnv(
      {
        WHATSAPP_TOKEN: undefined,
        WHATSAPP_ACCESS_TOKEN: undefined,
        WHATSAPP_PHONE_NUMBER_ID: undefined,
        NODE_ENV: "test",
      },
      async () => {
        const result = await notifyCallNextPatient({
          clinicId: "clinic-1",
          tokenId: "token-1",
          patientPhone: "9876543210",
          tokenNumber: 5,
        });
        assert.equal(result, false);
      },
    );
  });

  it("handles Meta 400 errors with parsed diagnostics", async () => {
    const error = parseMetaErrorResponse(
      400,
      JSON.stringify({
        error: {
          code: 132000,
          type: "OAuthException",
          message: "Number of parameters does not match",
          fbtrace_id: "trace-400",
        },
      }),
    );
    assert.equal(error.success, false);
    assert.equal(error.httpStatus, 400);
    assert.equal(error.errorCode, 132000);
    assert.equal(error.errorType, "OAuthException");
    assert.match(error.errorMessage ?? "", /parameters/i);
    assert.match(formatMetaErrorForLog(error), /status=400 code=132000/);
  });

  it("handles Meta 401/403 errors", () => {
    const unauthorized = parseMetaErrorResponse(
      401,
      JSON.stringify({
        error: { code: 190, type: "OAuthException", message: "Invalid token" },
      }),
    );
    const forbidden = parseMetaErrorResponse(
      403,
      JSON.stringify({
        error: { code: 200, type: "OAuthException", message: "Forbidden" },
      }),
    );
    assert.equal(unauthorized.httpStatus, 401);
    assert.equal(forbidden.httpStatus, 403);
  });

  it("handles Meta 429 and 500 errors", () => {
    const rateLimited = parseMetaErrorResponse(
      429,
      JSON.stringify({
        error: { code: 4, type: "OAuthException", message: "Rate limit" },
      }),
    );
    const serverError = parseMetaErrorResponse(
      500,
      JSON.stringify({
        error: { message: "Internal error" },
      }),
    );
    assert.equal(rateLimited.httpStatus, 429);
    assert.equal(serverError.httpStatus, 500);
  });

  it("sanitizes secrets and phone numbers from diagnostics", () => {
    const sanitized = sanitizeMetaDiagnostic(
      "Bearer EAAxxxxx failed for 919876543210 and 9876543210",
    );
    assert.doesNotMatch(sanitized, /EAAxxxxx/);
    assert.doesNotMatch(sanitized, /919876543210/);
    assert.doesNotMatch(sanitized, /9876543210/);
    assert.match(sanitized, /\[REDACTED\]/);
    assert.match(sanitized, /\[PHONE\]/);
  });

  it("postWhatsAppTemplateMessage returns success with message id", async () => {
    const restore = mockMetaFetch(200, {
      messages: [{ id: "wamid.test-message-id" }],
    });

    await withWhatsAppEnv(
      {
        WHATSAPP_TOKEN: "test-token",
        WHATSAPP_PHONE_NUMBER_ID: "123456789",
      },
      async () => {
        const result = await postWhatsAppTemplateMessage({
          messaging_product: "whatsapp",
          to: "919876543210",
          type: "template",
          template: {
            name: "patient_called",
            language: { code: "en" },
            components: [
              { type: "body", parameters: [{ type: "text", text: "5" }] },
            ],
          },
        });
        assert.equal(result.success, true);
        if (result.success) {
          assert.equal(result.messageId, "wamid.test-message-id");
        }
      },
    );

    restore();
  });

  it("notifyCallNextPatient returns false without throwing when Meta API fails", async () => {
    const restore = mockMetaFetch(400, {
      error: {
        code: 132000,
        type: "OAuthException",
        message: "Parameter count mismatch",
      },
    });

    await withWhatsAppEnv(
      {
        WHATSAPP_TOKEN: "test-token",
        WHATSAPP_PHONE_NUMBER_ID: "123456789",
        WHATSAPP_CALL_NEXT_TEMPLATE: "patient_called",
        WHATSAPP_CALL_NEXT_TEMPLATE_LANGUAGE: "en",
        WHATSAPP_CALL_NEXT_TEMPLATE_BODY_PARAMS: "token",
        NODE_ENV: "test",
      },
      async () => {
        const result = await notifyCallNextPatient({
          clinicId: "clinic-1",
          tokenId: "token-meta-fail",
          patientPhone: "9876543210",
          tokenNumber: 5,
        });
        assert.equal(result, false);
      },
    );

    restore();
  });

  it("claims notification_logs before sending for race-safe idempotency", () => {
    const source = read("lib/whatsapp-call-next.ts");
    const claimIndex = source.indexOf("claimCallNextNotificationSlot");
    const sendIndex = source.indexOf("postWhatsAppTemplateMessage(outboundPayload)");
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
    assert.match(
      migration,
      /create unique index if not exists notification_logs_called_token_unique/i,
    );
    assert.match(migration, /type = 'called'/);
  });

  it("Call Next route never depends on WhatsApp success", () => {
    const route = read("app/api/clinics/[id]/next/route.ts");
    assert.match(route, /notifyCallNextPatient/);
    assert.doesNotMatch(route, /if\s*\(\s*await notifyCallNextPatient/);
    assert.match(route, /return NextResponse\.json\(\{ patient: called \}\)/);
  });

  it("Call Next route notifies only the patient returned by atomic call-next", () => {
    const route = read("app/api/clinics/[id]/next/route.ts");
    assert.match(route, /if \(called\.patient_phone\)/);
    assert.match(route, /tokenId: called\.id/);
    assert.match(route, /patientPhone: called\.patient_phone/);
    assert.match(route, /patientName: called\.patient_name/);
    assert.match(route, /tokenNumber: called\.token_number/);
    assert.doesNotMatch(route, /for \(const .* of/);
  });

  it("Call Next route skips WhatsApp when patient has no phone", () => {
    const route = read("app/api/clinics/[id]/next/route.ts");
    const notifyBlocks = route.match(
      /if \(called\.patient_phone\)[\s\S]*?notifyCallNextPatient/g,
    );
    assert.ok(notifyBlocks && notifyBlocks.length >= 2);
  });

  it("keeps WhatsApp dial normalization aligned with lib/whatsapp.ts", () => {
    const callNextSource = read("lib/whatsapp-call-next.ts");
    const whatsappSource = read("lib/whatsapp.ts");
    const extractDialFn = (source: string) => {
      const match = source.match(
        /function formatWhatsAppDialNumber\(phone: string\): string \{[\s\S]*?\n\}/,
      );
      return match?.[0] ?? "";
    };

    assert.equal(
      extractDialFn(callNextSource),
      extractDialFn(whatsappSource),
      "formatWhatsAppDialNumber must match lib/whatsapp.ts",
    );
  });

  it("does not log WhatsApp access tokens in call-next module", () => {
    const source = read("lib/whatsapp-call-next.ts");
    assert.doesNotMatch(
      source,
      /console\.(log|warn|error)\([^)]*token[^)]*Bearer/i,
    );
    assert.doesNotMatch(
      source,
      /console\.(log|warn|error)\([^)]*WHATSAPP_TOKEN/i,
    );
    assert.doesNotMatch(
      source,
      /console\.(log|warn|error)\([^)]*patientPhone/i,
    );
  });

  it("exports call-next notification type used for idempotency", () => {
    assert.equal(CALL_NEXT_NOTIFICATION_TYPE, "called");
  });
});
