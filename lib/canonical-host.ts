export const CANONICAL_PRODUCTION_SITE_URL = "https://www.skiplines.in";

const VERCEL_APP_HOST = /\.vercel\.app$/i;

export function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production";
}

export function isVercelAppHost(host: string) {
  return VERCEL_APP_HOST.test(host);
}

export function shouldRedirectToCanonicalHost(host: string) {
  return isProductionDeployment() && isVercelAppHost(host);
}

export function buildCanonicalRedirectUrl(pathname: string, search: string) {
  return new URL(`${pathname}${search}`, CANONICAL_PRODUCTION_SITE_URL);
}
