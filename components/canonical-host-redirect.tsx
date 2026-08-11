"use client";

import { useEffect } from "react";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";
import { isVercelAppHost } from "@/lib/canonical-host";

/**
 * Client-side safety net: if a patient lands on a Vercel deployment host
 * (e.g. from an old QR code), move them to the canonical production domain.
 */
export function CanonicalHostRedirect() {
  useEffect(() => {
    const host = window.location.hostname;
    if (!isVercelAppHost(host)) {
      return;
    }

    const destination = `${CANONICAL_PRODUCTION_SITE_URL}${window.location.pathname}${window.location.search}`;
    window.location.replace(destination);
  }, []);

  return null;
}
