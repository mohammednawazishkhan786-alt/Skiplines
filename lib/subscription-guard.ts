import { NextResponse } from "next/server";
import { requireDoctorAuth } from "@/lib/auth/doctor";
import { getClinicOrThrow, getSubscriptionAccessError } from "@/lib/clinic-access";
import type { Clinic } from "@/lib/types";

export function subscriptionLockedResponse(message: string) {
  return NextResponse.json(
    { error: message, code: "SUBSCRIPTION_REQUIRED" },
    { status: 403 },
  );
}

/**
 * Requires authenticated doctor with active trial or paid subscription.
 * Returns null when access is allowed, or a NextResponse to return immediately.
 */
export async function requireDoctorSubscription(
  request: Request,
  clinicId: string,
): Promise<{ clinic: Clinic } | NextResponse> {
  const authError = requireDoctorAuth(request, clinicId);
  if (authError) {
    return authError;
  }

  const { clinic, error } = await getClinicOrThrow(clinicId);
  if (!clinic) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const accessError = getSubscriptionAccessError(clinic);
  if (accessError) {
    return subscriptionLockedResponse(accessError);
  }

  return { clinic };
}
