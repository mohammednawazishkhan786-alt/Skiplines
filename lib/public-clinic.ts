import type { Clinic } from "./types";

/** Fields safe to expose on public patient-facing endpoints. */
export const PUBLIC_CLINIC_SELECT =
  "id, doctor_name, clinic_name, avg_time_per_patient, current_token" as const;

export type PublicClinic = Pick<
  Clinic,
  | "id"
  | "doctor_name"
  | "clinic_name"
  | "avg_time_per_patient"
  | "current_token"
>;

export function toPublicClinic(clinic: Clinic): PublicClinic {
  return {
    id: clinic.id,
    doctor_name: clinic.doctor_name,
    clinic_name: clinic.clinic_name,
    avg_time_per_patient: clinic.avg_time_per_patient,
    current_token: clinic.current_token,
  };
}
