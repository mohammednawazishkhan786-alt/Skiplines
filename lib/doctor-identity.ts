/**
 * Application-level Doctor identity.
 *
 * The billing/auth identity is `clinics.id` — a permanent server-assigned UUID.
 * Queue/patient URLs still use `clinic_id` as the foreign-key column name.
 */
import {
  isValidClinicId,
  verifyClinicOwnership,
} from "./clinic-identity";

export type DoctorRecord = {
  id: string;
};

export function isValidDoctorId(
  doctorId: string | null | undefined,
): doctorId is string {
  return isValidClinicId(doctorId);
}

/** Permanent Doctor ID from an authenticated clinic/doctor row. */
export function getDoctorId(record: DoctorRecord): string {
  return record.id;
}

export function verifyDoctorOwnership(
  authenticatedDoctorId: string | null | undefined,
  recordDoctorId: string | null | undefined,
) {
  return verifyClinicOwnership(authenticatedDoctorId, recordDoctorId);
}
