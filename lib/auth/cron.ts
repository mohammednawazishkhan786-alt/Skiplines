export function getCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.startsWith("your_")) {
    return undefined;
  }
  return secret;
}

export function isAuthorizedJobRequest(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET is not configured — rejecting background job request.",
    );
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
