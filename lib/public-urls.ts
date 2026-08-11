import { getCanonicalSiteUrl } from "@/lib/env";

export function buildClinicPageUrl(clinicId: string) {
  return `${getCanonicalSiteUrl()}/clinic/${clinicId}`;
}

export function buildLiveTrackerUrl(tokenId: string) {
  return `${getCanonicalSiteUrl()}/live/${tokenId}`;
}

export function buildJoinPageUrl(clinicId: string) {
  return `${getCanonicalSiteUrl()}/join/${clinicId}`;
}
