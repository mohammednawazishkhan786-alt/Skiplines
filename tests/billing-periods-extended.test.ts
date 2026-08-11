import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarMonth,
  computeMonthlyPeriod,
  extendMonthlyPeriod,
} from "../lib/subscription-periods.ts";

function iso(date: Date) {
  return date.toISOString();
}

describe("billing periods", () => {
  it("handles Jan 31 to February correctly", () => {
    const start = new Date("2026-01-31T10:00:00.000Z");
    const end = addCalendarMonth(start, 1);
    assert.equal(end.getUTCMonth(), 1);
    assert.equal(end.getUTCDate(), 28);
  });

  it("handles leap year February to March", () => {
    const start = new Date("2024-02-29T00:00:00.000Z");
    const end = addCalendarMonth(start, 1);
    assert.equal(end.getUTCMonth(), 2);
    assert.equal(end.getUTCDate(), 29);
  });

  it("handles 30-day month rollover", () => {
    const start = new Date("2026-04-30T12:00:00.000Z");
    const end = addCalendarMonth(start, 1);
    assert.equal(end.getUTCMonth(), 4);
    assert.equal(end.getUTCDate(), 30);
  });

  it("handles 31-day month to 30-day month", () => {
    const start = new Date("2026-05-31T12:00:00.000Z");
    const end = addCalendarMonth(start, 1);
    assert.equal(end.getUTCMonth(), 5);
    assert.equal(end.getUTCDate(), 30);
  });

  it("handles year transition", () => {
    const start = new Date("2026-12-15T00:00:00.000Z");
    const end = addCalendarMonth(start, 1);
    assert.equal(end.getUTCFullYear(), 2027);
    assert.equal(end.getUTCMonth(), 0);
  });

  it("keeps next_billing_date aligned with current_period_end", () => {
    const paymentAt = new Date("2026-08-11T06:00:00.000Z");
    const period = computeMonthlyPeriod(paymentAt);
    assert.equal(period.next_billing_date, period.current_period_end);
    assert.equal(
      new Date(period.current_period_end).getTime(),
      addCalendarMonth(paymentAt, 1).getTime(),
    );
  });

  it("extends from existing period end without shortening access", () => {
    const existingEnd = new Date("2026-09-11T06:00:00.000Z");
    const from = new Date("2026-08-11T06:00:00.000Z");
    const extended = extendMonthlyPeriod(iso(existingEnd), from);
    assert.equal(extended.current_period_start, iso(existingEnd));
    assert.equal(
      extended.current_period_end,
      iso(addCalendarMonth(existingEnd, 1)),
    );
  });
});
