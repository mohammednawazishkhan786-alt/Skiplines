/**
 * Journey-level E2E assertions that do not require live Production credentials.
 * Covers critical product invariants for join → public token → standee URL paths.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { toPublicToken } from "../lib/public-token.ts";
import { isValidIndianMobile } from "../lib/phone.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("E2E product wiring (static journey checks)", () => {
  it("join UI collects patient name and phone", () => {
    const joinPage = read("app/join/[clinicId]/join-form.tsx");
    assert.match(joinPage, /patient_name/);
    assert.match(joinPage, /patient_phone/);
    assert.match(joinPage, /isValidIndianMobile/);
  });

  it("join page returns notFound for missing clinics", () => {
    const joinPage = read("app/join/[clinicId]/page.tsx");
    assert.match(joinPage, /notFound\(\)/);
    assert.match(joinPage, /getPublicClinicOrThrow/);
  });

  it("clinic booking UI collects patient name and phone", () => {
    const booking = read("app/clinic/[clinicId]/clinic-booking.tsx");
    assert.match(booking, /patient_name/);
    assert.match(booking, /patient_phone/);
  });

  it("registration collects clinic phone (not email-as-phone)", () => {
    const registerUi = read("app/register/page.tsx");
    const registerApi = read("app/api/clinics/route.ts");
    assert.match(registerUi, /Clinic WhatsApp/);
    assert.match(registerApi, /isValidIndianMobile/);
    assert.doesNotMatch(registerApi, /phone:\s*email/);
  });

  it("dashboard exposes standee download", () => {
    const dashboard = read("app/dashboard/page.tsx");
    assert.match(dashboard, /PatientStandeeDownload/);
    assert.match(read("components/patient-standee-download.tsx"), /\/api\/clinics\/\$\{clinicId\}\/standee/);
  });

  it("public token sanitizer strips patient PII", () => {
    const publicToken = toPublicToken({
      id: "t1",
      clinic_id: "c1",
      token_number: 1,
      queue_position: 1,
      status: "waiting",
      is_emergency: false,
      is_late: false,
      estimated_call_at: null,
      completed_at: null,
      late_shift_count: 0,
      created_at: new Date().toISOString(),
      patient_name: "Secret",
      patient_phone: "9876543210",
    });
    assert.equal("patient_phone" in publicToken, false);
    assert.equal("patient_name" in publicToken, false);
  });

  it("review cron does not invent google review URLs", () => {
    const reviews = read("app/api/reviews/send/route.ts");
    assert.doesNotMatch(reviews, /g\.page\/r\/review/);
    assert.doesNotMatch(reviews, /DEFAULT_GOOGLE_REVIEW_URL/);
  });

  it("active payment path remains create-order (not subscription UI)", () => {
    const dashboard = read("app/dashboard/page.tsx");
    assert.match(dashboard, /\/api\/cashfree\/create-order/);
    assert.doesNotMatch(dashboard, /create-subscription/);
  });

  it("validates a typical patient phone used in smoke journeys", () => {
    assert.equal(isValidIndianMobile("9876543210"), true);
  });
});
