import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Postgres-backed rate limiter for serverless environments.
 * Falls back to allow if the table is unavailable (e.g. before migration).
 */
export async function checkDistributedRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const resetAt = new Date(now.getTime() + options.windowMs);

    const { data: existing } = await supabase
      .from("rate_limit_buckets")
      .select("count, reset_at")
      .eq("bucket_key", key)
      .maybeSingle();

    if (!existing || new Date(existing.reset_at) <= now) {
      await supabase.from("rate_limit_buckets").upsert({
        bucket_key: key,
        count: 1,
        reset_at: resetAt.toISOString(),
        updated_at: now.toISOString(),
      });
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

    await supabase
      .from("rate_limit_buckets")
      .update({
        count: existing.count + 1,
        updated_at: now.toISOString(),
      })
      .eq("bucket_key", key);

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
