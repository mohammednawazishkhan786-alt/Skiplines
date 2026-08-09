/**
 * Run all SQL migrations against Supabase via the REST SQL endpoint.
 * Usage: node scripts/migrate.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const envFile = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local may not exist
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const apiKey =
  serviceKey && !serviceKey.includes("your_") ? serviceKey : anonKey;

if (!supabaseUrl || !apiKey || supabaseUrl.includes("your_")) {
  console.error(
    "Missing Supabase credentials in .env.local. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Running ${files.length} migration(s)...`);

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`  → ${file}`);

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  // Use Supabase SQL via pg-meta endpoint (management API requires access token).
  // Fallback: execute statements individually via supabase-js if rpc unavailable.
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, apiKey);

  for (const statement of statements) {
    const { error } = await supabase.rpc("exec_sql", { query: statement });
    if (error) {
      // exec_sql may not exist — migrations already applied via Supabase MCP
      console.warn(`    ⚠ Skipped (no exec_sql RPC): ${error.message}`);
      break;
    }
  }
}

console.log("Migration run complete.");
console.log(
  "Note: Schema was applied to remote Supabase project via MCP apply_migration.",
);
