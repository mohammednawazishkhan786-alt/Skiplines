import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionAccessError } from "@/lib/subscription-access";
import type { Clinic } from "@/lib/types";

const PUBLIC_CLINIC_SELECT =
  "id, doctor_name, clinic_name, avg_time_per_patient, current_token, clinic_hours, consultation_fee";

export async function getClinicOrThrow(clinicId: string) {
  const supabase = createAdminClient();
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .single();

  if (error || !clinic) {
    return { clinic: null, error: "Clinic not found." as const };
  }

  return { clinic: clinic as Clinic, error: null };
}

/** Public patient page — no private fields. */
export async function getPublicClinicOrThrow(clinicId: string) {
  const supabase = createAdminClient();
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select(PUBLIC_CLINIC_SELECT)
    .eq("id", clinicId)
    .single();

  if (error || !clinic) {
    return { clinic: null, error: "Clinic not found." as const };
  }

  return { clinic, error: null };
}

export { getSubscriptionAccessError };
