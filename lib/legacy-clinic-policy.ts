/**
 * Safe metadata backfill rules for clinics created before production hardening.
 * Does NOT grant paid access or extend trials.
 */

export type LegacyClinicRow = {
  id: string;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
  current_period_start: string | null;
  created_at: string;
};

export function shouldBackfillTrialStartedAt(clinic: LegacyClinicRow) {
  const status = clinic.subscription_status?.trim().toLowerCase() ?? "";
  return (
    !clinic.trial_started_at &&
    Boolean(clinic.trial_ends_at) &&
    (status === "trial" || status === "trialing")
  );
}

export function deriveTrialStartedAt(trialEndsAt: string) {
  const ends = new Date(trialEndsAt);
  return new Date(ends.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export function classifyLegacyClinic(clinic: LegacyClinicRow) {
  const status = clinic.subscription_status?.trim().toLowerCase() ?? "";

  if (status === "active" && clinic.subscription_expires_at) {
    return "legacy_active_paid" as const;
  }

  if ((status === "trial" || status === "trialing") && clinic.trial_ends_at) {
    return "legacy_trial_with_end" as const;
  }

  if (status === "pending_mandate" || status === "pending_payment") {
    return "legacy_pending_payment" as const;
  }

  return "legacy_other" as const;
}
