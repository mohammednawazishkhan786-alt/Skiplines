import { getCanonicalSiteUrl } from "@/lib/env";
import { isValidClinicId } from "@/lib/clinic-identity";
import { buildClinicPageUrl } from "@/lib/public-urls";

export function buildPatientQrUrl(clinicId: string) {
  const normalizedId = clinicId.trim();

  if (!isValidClinicId(normalizedId)) {
    throw new Error("Invalid clinic identifier.");
  }

  const base = getCanonicalSiteUrl();

  if (base.includes("localhost") || base.includes("vercel.app")) {
    throw new Error("Patient QR requires the production app URL.");
  }

  return buildClinicPageUrl(normalizedId);
}

export function buildClinicUrl(clinicId: string) {
  return buildPatientQrUrl(clinicId);
}
