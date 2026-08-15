"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";
import { isVercelAppHost } from "@/lib/canonical-host";

const GA_MEASUREMENT_ID = "G-VC5Z65ZBFV";

/**
 * Client-side safety net: if a patient lands on a Vercel deployment host
 * (e.g. from an old QR code), move them to the canonical production domain.
 */
export function CanonicalHostRedirect() {
  const pathname = usePathname();
  const isInitialPathname = useRef(true);

  useEffect(() => {
    const host = window.location.hostname;
    if (!isVercelAppHost(host)) {
      return;
    }

    const destination = `${CANONICAL_PRODUCTION_SITE_URL}${window.location.pathname}${window.location.search}`;
    window.location.replace(destination);
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (isInitialPathname.current) {
      isInitialPathname.current = false;
      return;
    }

    const gtag = (
      window as Window & { gtag?: (...args: unknown[]) => void }
    ).gtag;
    if (gtag) {
      gtag("config", GA_MEASUREMENT_ID, { page_path: pathname });
    }
  }, [pathname]);

  return null;
}
