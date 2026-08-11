/**
 * Permanent public clinic identifier.
 *
 * `clinic_id` is the `clinics.id` column: a UUID assigned once by PostgreSQL
 * (`gen_random_uuid()` default) at registration. It is never derived from
 * doctor name, email, phone, or other personal data.
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
