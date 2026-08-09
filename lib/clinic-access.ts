import { createClient } from "@/lib/supabase/server";
import { hasDashboardAccess } from "@/lib/subscription";
import type { Clinic } from "@/lib/types";

export async function getClinicOrThrow(clinicId: string) {
  const supabase = await createClient();
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

export function getSubscriptionAccessError(
  clinic: Pick<
    Clinic,
    "subscription_status" | "trial_ends_at" | "subscription_expires_at"
  >,
) {
  if (hasDashboardAccess(clinic)) {
    return null;
  }

  const status = clinic.subscription_status.toUpperCase();

  if (status === "PENDING_MANDATE") {
    return "Complete your ₹1 UPI mandate authorization to start your free trial.";
  }

  return "Your subscription has expired. Please renew to access the queue dashboard.";
}
