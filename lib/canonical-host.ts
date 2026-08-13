export const CANONICAL_PRODUCTION_SITE_URL = "https://www.skiplines.in";

const VERCEL_APP_HOST = /\.vercel\.app$/i;
const APEX_PRODUCTION_HOST = "skiplines.in";

const VERCEL_CRON_JOB_PATHS = new Set([
  "/api/jobs/confirmations",
  "/api/jobs/reconcile-subscriptions",
  "/api/reviews/send",
]);

export function normalizeCronPathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isVercelCronJobPath(pathname: string) {
  return VERCEL_CRON_JOB_PATHS.has(normalizeCronPathname(pathname));
}

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function isVercelAppHost(host: string) {
  return VERCEL_APP_HOST.test(host);
}

export function isApexProductionHost(host: string) {
  return host.toLowerCase() === APEX_PRODUCTION_HOST;
}

export function shouldRedirectToCanonicalHost(host: string, pathname = "") {
  if (isVercelCronJobPath(pathname)) {
    return false;
  }

  if (!isProductionDeployment()) {
    return false;
  }

  return isVercelAppHost(host) || isApexProductionHost(host);
}

export function buildCanonicalRedirectUrl(pathname: string, search: string) {
  return new URL(`${pathname}${search}`, CANONICAL_PRODUCTION_SITE_URL);
}
