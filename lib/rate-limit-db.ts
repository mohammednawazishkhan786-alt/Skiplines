/**
 * Postgres-backed rate limiter for serverless environments.
 *
 * Default failClosed=false preserves previous soft-fail behavior for queue
 * endpoints. OTP paths must pass failClosed:true.
 */
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** When true, deny requests if the rate-limit store is unavailable. */
  failClosed?: boolean;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkDistributedRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const failClosed = options.failClosed === true;

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const resetAt = new Date(now.getTime() + options.windowMs);

    const { data: existing, error: selectError } = await supabase
      .from("rate_limit_buckets")
      .select("count, reset_at")
      .eq("bucket_key", key)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (!existing || new Date(existing.reset_at) <= now) {
      const { error: upsertError } = await supabase
        .from("rate_limit_buckets")
        .upsert({
          bucket_key: key,
          count: 1,
          reset_at: resetAt.toISOString(),
          updated_at: now.toISOString(),
        });
      if (upsertError) {
        throw upsertError;
      }
      return { allowed: true };
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (new Date(existing.reset_at).getTime() - now.getTime()) / 1000,
        ),
      );
      return { allowed: false, retryAfterSeconds };
    }

    const { error: updateError } = await supabase
      .from("rate_limit_buckets")
      .update({
        count: existing.count + 1,
        updated_at: now.toISOString(),
      })
      .eq("bucket_key", key);

    if (updateError) {
      throw updateError;
    }

    return { allowed: true };
  } catch {
    if (failClosed) {
      return { allowed: false, retryAfterSeconds: 30 };
    }
    return { allowed: true };
  }
}
