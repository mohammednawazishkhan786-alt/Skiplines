import { checkDistributedRateLimit } from "@/lib/rate-limit-db";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";

type LimitOptions = {
  windowMs: number;
  max: number;
  /** Default true for abuse-sensitive endpoints. */
  failClosed?: boolean;
};

/**
 * Distributed (Postgres) + in-memory rate limit.
 * Both must allow the request.
 */
export async function enforceRateLimit(
  request: Request,
  key: string,
  options: LimitOptions,
) {
  const distributed = await checkDistributedRateLimit(key, options);
  if (!distributed.allowed) {
    return rateLimitResponse(distributed.retryAfterSeconds);
  }

  const memory = checkRateLimit(key, options);
  if (!memory.allowed) {
    return rateLimitResponse(memory.retryAfterSeconds);
  }

  return null;
}

export function ipKey(request: Request, suffix: string) {
  return `${suffix}:ip:${getClientIp(request)}`;
}
