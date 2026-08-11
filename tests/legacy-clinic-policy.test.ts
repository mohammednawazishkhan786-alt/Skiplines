import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLegacyClinic,
  deriveTrialStartedAt,
  shouldBackfillTrialStartedAt,
} from "../lib/legacy-clinic-policy.ts";

const CITY_CARE = {
  id: "adda7e3d-70bb-4c40-8ef9-42740b9f1762",
  subscription_status: "trial",
  trial_started_at: null,
  trial_ends_at: "2026-08-15T15:47:48.836Z",
  subscription_expires_at: null,
  current_period_start: null,
  created_at: "2026-08-08T15:47:49.647Z",
};

const NAWAZ_PENDING = {
  id: "9376eb65-e3e9-4142-a54b-a6f4c0d449ad",
  subscription_status: "pending_mandate",
  trial_started_at: null,
  trial_ends_at: null,
  subscription_expires_at: null,
  current_period_start: null,
  created_at: "2026-08-09T19:17:50.456Z",
};

const NAWAZ_ACTIVE = {
  id: "a6e17ade-4d3d-4bad-98b1-018cff62c174",
  subscription_status: "active",
  trial_started_at: null,
  trial_ends_at: null,
  subscription_expires_at: "2026-09-09T18:26:56.957Z",
  current_period_start: null,
  created_at: "2026-08-10T13:59:16.624Z",
};

describe("legacy clinic policy", () => {
  it("backfills trial_started_at only for trial rows with trial_ends_at", () => {
    assert.equal(shouldBackfillTrialStartedAt(CITY_CARE), true);
    assert.equal(shouldBackfillTrialStartedAt(NAWAZ_PENDING), false);
    assert.equal(shouldBackfillTrialStartedAt(NAWAZ_ACTIVE), false);
  });

  it("derives trial_started_at as exactly 7 days before trial_ends_at", () => {
    const started = deriveTrialStartedAt(CITY_CARE.trial_ends_at!);
    const diff =
      new Date(CITY_CARE.trial_ends_at!).getTime() - new Date(started).getTime();
    assert.equal(diff, 7 * 24 * 60 * 60 * 1000);
  });

  it("classifies production legacy clinics without changing access", () => {
    assert.equal(classifyLegacyClinic(CITY_CARE), "legacy_trial_with_end");
    assert.equal(classifyLegacyClinic(NAWAZ_PENDING), "legacy_pending_payment");
    assert.equal(classifyLegacyClinic(NAWAZ_ACTIVE), "legacy_active_paid");
  });
});
