import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVALID_PHONE_MESSAGE,
  isValidIndianMobile,
  normalizePhone,
} from "../lib/phone.ts";

describe("Indian mobile validation", () => {
  it("normalizes to last 10 digits", () => {
    assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
    assert.equal(normalizePhone("919876543210"), "9876543210");
  });

  it("accepts valid Indian mobiles starting 6-9", () => {
    assert.equal(isValidIndianMobile("9876543210"), true);
    assert.equal(isValidIndianMobile("6123456789"), true);
    assert.equal(isValidIndianMobile("+91-6123456789"), true);
  });

  it("rejects invalid lengths and landline-like starts", () => {
    assert.equal(isValidIndianMobile("1234567890"), false);
    assert.equal(isValidIndianMobile("98765"), false);
    assert.equal(isValidIndianMobile(""), false);
    assert.equal(isValidIndianMobile("abcdef"), false);
  });

  it("exports a user-facing error message", () => {
    assert.match(INVALID_PHONE_MESSAGE, /10-digit/i);
  });
});
