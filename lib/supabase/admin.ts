import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function isProductionRuntime() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function readServiceRoleKey(): string | undefined {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey || serviceKey.startsWith("your_")) {
    return undefined;
  }
  return serviceKey;
}

export function isUsingServiceRoleKey(): boolean {
  return Boolean(readServiceRoleKey());
}

function resolveSupabaseAdminKey() {
  const serviceKey = readServiceRoleKey();
  if (serviceKey) {
    return { key: serviceKey, isServiceRole: true as const };
  }

  if (isProductionRuntime()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be configured in production for server-side database writes.",
    );
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anonKey && !anonKey.startsWith("your_")) {
    return { key: anonKey, isServiceRole: false as const };
  }

  return null;
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const credentials = resolveSupabaseAdminKey();

  if (!url || !credentials || url.startsWith("your_")) {
    throw new Error("Missing Supabase credentials.");
  }

  if (!credentials.isServiceRole && !isProductionRuntime()) {
    console.warn(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing — using anon key in non-production only.",
    );
  }

  return createClient(url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client for OTP table writes (bypasses RLS when service key is set). */
export function createOtpStoreClient(): SupabaseClient {
  return createAdminClient();
}

export function formatSupabaseError(
  error: { message?: string; code?: string; details?: string },
  fallback: string,
) {
  const message = error.message?.trim() || fallback;
  const combined = `${message} ${error.details ?? ""}`.toLowerCase();

  if (
    error.code === "42501" ||
    combined.includes("permission denied") ||
    combined.includes("row-level security") ||
    combined.includes("rls")
  ) {
    return "OTP storage permission denied. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.";
  }

  if (
    combined.includes("email_otp_requests") &&
    (combined.includes("does not exist") || combined.includes("relation"))
  ) {
    return "OTP database table is missing. Run the latest Supabase migrations.";
  }

  if (
    combined.includes("duplicate key") ||
    error.code === "23505"
  ) {
    return "An OTP was already sent recently. Please wait and try again.";
  }

  return message;
}
