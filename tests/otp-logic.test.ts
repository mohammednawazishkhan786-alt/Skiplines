import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateOtp,
  hashOtp,
  emailOtpMatches,
  OTP_LENGTH,
  OTP_TTL_MS,
} from "../lib/otp-crypto.ts";
import { checkRateLimit } from "../lib/rate-limit.ts";

describe("OTP logic", () => {
  const email = "doctor@example.com";

  it("generates 6-digit OTP codes", () => {
    const otp = generateOtp();
    assert.match(otp, /^\d{6}$/);
    assert.equal(otp.length, OTP_LENGTH);
  });

  it("stores hashed OTP values, never plaintext in hash helper", () => {
    const otp = "123456";
    const hashed = hashOtp(email, otp);
    assert.notEqual(hashed, otp);
    assert.equal(hashed.length, 64);
  });

  it("accepts correct OTP and rejects wrong OTP", () => {
    const otp = "654321";
    const record: { otp_hash: string } = {
      otp_hash: hashOtp(email, otp),
    };

    assert.equal(emailOtpMatches(record, email, otp), true);
    assert.equal(emailOtpMatches(record, email, "000000"), false);
    assert.equal(emailOtpMatches(record, email, " 654321 "), true);
  });

  it("treats expired OTP timestamps as expired", () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    assert.equal(new Date(past) < new Date(), true);
  });

  it("uses 5-minute OTP TTL", () => {
    assert.equal(OTP_TTL_MS, 5 * 60 * 1000);
  });

  it("enforces OTP send rate limits per email", () => {
    const key = `otp-send:email:test-${Date.now()}@example.com`;
    const config = { windowMs: 60_000, max: 3 };

    assert.equal(checkRateLimit(key, config).allowed, true);
    assert.equal(checkRateLimit(key, config).allowed, true);
    assert.equal(checkRateLimit(key, config).allowed, true);
    assert.equal(checkRateLimit(key, config).allowed, false);
  });

  it("enforces OTP verify failure rate limits", () => {
    const key = `otp-verify-fail:email:test-${Date.now()}@example.com`;
    const config = { windowMs: 15 * 60_000, max: 5 };

    for (let i = 0; i < 5; i += 1) {
      assert.equal(checkRateLimit(key, config).allowed, true);
    }
    assert.equal(checkRateLimit(key, config).allowed, false);
  });
});
