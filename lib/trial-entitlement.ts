import { trialEndsAtFromConfigured } from "./subscription-access";

export const TRIAL_ALREADY_USED_CODE = "TRIAL_ALREADY_USED" as const;

export const TRIAL_ENTITLEMENT_USED_MESSAGE =
  "This email address has already used a 7-day free trial.";

export type TrialEntitlementRow = {
  trial_used?: boolean | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

export type ExistingDoctorLookup = {
  id: string;
  trial_used?: boolean | null;
} | null;

/**
 * Server-side fields for the ONE lifetime trial claim at registration.
 * `trial_used` is set true immediately and must never return to false.
 */
export function buildNewDoctorTrialFields(now = new Date()) {
  const startedAt = now.toISOString();
  return {
    trial_used: true,
    trial_started_at: startedAt,
    trial_ends_at: trialEndsAtFromConfigured(now.getTime()),
    subscription_status: "trialing" as const,
  };
}

export function hasClaimedTrialEntitlement(
  row: Pick<TrialEntitlementRow, "trial_used">,
) {
  return row.trial_used === true;
}

export function findTrialAbuseConflict(
  existingByEmail: ExistingDoctorLookup,
  existingByPhone: ExistingDoctorLookup,
): { code: typeof TRIAL_ALREADY_USED_CODE; message: string } | null {
  if (existingByEmail || existingByPhone) {
    return {
      code: TRIAL_ALREADY_USED_CODE,
      message: TRIAL_ENTITLEMENT_USED_MESSAGE,
    };
  }

  return null;
}

export function isUniqueTrialViolation(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}
