/**
 * Permanent Skiplines Doctor ID.
 *
 * `clinics.id` is the one permanent UUID for a doctor account. It is assigned
 * once at registration and never changes after payment, renewal, login, or
 * logout. It is not the Cashfree order ID, email, or phone number.
 * Queue rows still reference this same id as `clinic_id`.
 */
const CLINIC_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidClinicId(
  clinicId: string | null | undefined,
): clinicId is string {
  if (!clinicId) {
    return false;
  }

  return CLINIC_ID_PATTERN.test(clinicId.trim());
}

/** Permanent Doctor ID — same UUID as {@link isValidClinicId}. */
export const isValidDoctorId = isValidClinicId;

export function verifyClinicOwnership(
  authenticatedClinicId: string | null | undefined,
  clinicRecordId: string | null | undefined,
) {
  if (
    !isValidClinicId(authenticatedClinicId) ||
    !isValidClinicId(clinicRecordId)
  ) {
    return false;
  }

  return authenticatedClinicId.trim() === clinicRecordId.trim();
}

/** Doctor billing identity ownership — same as {@link verifyClinicOwnership}. */
export const verifyDoctorOwnership = verifyClinicOwnership;
