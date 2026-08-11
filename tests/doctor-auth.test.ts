import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  createDoctorToken,
  verifyDoctorAuth,
  verifyDoctorToken,
} from "../lib/auth/doctor-token.ts";

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

describe("doctor authorization", () => {
  it("allows access only to the clinic encoded in the token", () => {
    withDoctorSecret(() => {
      const token = createDoctorToken(CLINIC_A);
      const request = new Request("https://www.skiplines.in/api/clinics/x", {
        headers: { cookie: `doctor_token=${encodeURIComponent(token)}` },
      });

      assert.equal(verifyDoctorAuth(request, CLINIC_A), true);
      assert.equal(verifyDoctorAuth(request, CLINIC_B), false);
    });
  });

  it("rejects tampered clinic ownership in token payload", () => {
    withDoctorSecret(() => {
      const token = createDoctorToken(CLINIC_A);
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          clinicId: CLINIC_B,
          exp: Date.now() + 60_000,
        }),
      ).toString("base64url");
      const tampered = `${tamperedPayload}.${token.split(".")[1]}`;
      const request = new Request("https://www.skiplines.in/api/clinics/x", {
        headers: { cookie: `doctor_token=${encodeURIComponent(tampered)}` },
      });

      assert.equal(verifyDoctorAuth(request, CLINIC_B), false);
      assert.equal(verifyDoctorToken(tampered), null);
    });
  });

  it("rejects expired doctor tokens", () => {
    withDoctorSecret(() => {
      const encodedPayload = Buffer.from(
        JSON.stringify({
          clinicId: CLINIC_A,
          exp: Date.now() - 1_000,
        }),
      ).toString("base64url");
      const signature = createHmac("sha256", process.env.DOCTOR_AUTH_SECRET!)
        .update(encodedPayload)
        .digest("base64url");
      const expiredToken = `${encodedPayload}.${signature}`;
      const request = new Request("https://www.skiplines.in/api/clinics/x", {
        headers: {
          cookie: `doctor_token=${encodeURIComponent(expiredToken)}`,
        },
      });

      assert.equal(verifyDoctorAuth(request, CLINIC_A), false);
      assert.equal(verifyDoctorToken(expiredToken), null);
    });
  });

  it("rejects requests without doctor_token cookie", () => {
    withDoctorSecret(() => {
      const request = new Request("https://www.skiplines.in/api/clinics/x");
      assert.equal(verifyDoctorAuth(request, CLINIC_A), false);
    });
  });
});
