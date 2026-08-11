type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true as const };
  }

  if (bucket.count >= options.max) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true as const };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please try again later.",
      retry_after_seconds: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
