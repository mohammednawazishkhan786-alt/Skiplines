/**
 * Preview-only Cashfree sandbox E2E. Never prints secrets/OTP/cookies/tokens.
 * Usage:
 *   node scripts/preview-sandbox-e2e.mjs
 * Optional:
 *   E2E_BASE_URL, E2E_CRON_SECRET, E2E_CASHFREE_APP_ID, E2E_CASHFREE_SECRET_KEY
 *   E2E_ENV_FILE (dotenv from `vercel env pull`, never logged)
 */
import { createHash } from "node:crypto";
import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  mkdtempSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE =
  process.env.E2E_BASE_URL ||
  "https://skiplines-sandbox-e2e-nawazish-khans-projects.vercel.app";
const DEPLOYMENT = BASE.replace(/^https?:\/\//, "");
const results = [];
const WORK = mkdtempSync(join(tmpdir(), "skiplines-e2e-"));
const cookieFile = join(WORK, "cookies.txt");
writeFileSync(cookieFile, "");

function log(step, status, detail = "") {
  results.push({ step, status, detail });
  console.log(`${status}: ${step}${detail ? ` — ${detail}` : ""}`);
}

function scrub(text) {
  return String(text || "")
    .replace(/x-vercel-protection-bypass:\s*\S+/gi, "x-vercel-protection-bypass: <redacted>")
    .replace(/(_vercel_jwt|doctor_token|session_token)=[^;\s]+/gi, "$1=<redacted>")
    .replace(/Bearer\s+\S+/gi, "Bearer <redacted>")
    .replace(/"session_token"\s*:\s*"[^"]+"/gi, '"session_token":"<redacted>"')
    .replace(/"payment_session_id"\s*:\s*"[^"]+"/gi, '"payment_session_id":"<redacted>"')
    .replace(/"dev_otp"\s*:\s*"[^"]+"/gi, '"dev_otp":"<redacted>"')
    .replace(/\b\d{6}\b/g, "<otp?>");
}

function loadEnvFile(path) {
  if (!path || !existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const pulled = loadEnvFile(process.env.E2E_ENV_FILE);

function loadDotEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return {};
  return loadEnvFile(p);
}

function usableSecret(v) {
  if (!v || typeof v !== "string") return "";
  const t = v.trim();
  if (!t || t === "Encrypted" || t.startsWith("your_") || t.length < 8) {
    return "";
  }
  return t;
}

const localEnv = loadDotEnvLocal();
const cronSecret =
  usableSecret(process.env.E2E_CRON_SECRET) ||
  usableSecret(pulled.CRON_SECRET) ||
  usableSecret(process.env.CRON_SECRET) ||
  usableSecret(localEnv.CRON_SECRET) ||
  "";
const cashfreeAppId =
  usableSecret(process.env.E2E_CASHFREE_APP_ID) ||
  usableSecret(pulled.NEXT_PUBLIC_CASHFREE_APP_ID) ||
  usableSecret(localEnv.NEXT_PUBLIC_CASHFREE_APP_ID) ||
  "";
const cashfreeSecret =
  usableSecret(process.env.E2E_CASHFREE_SECRET_KEY) ||
  usableSecret(pulled.CASHFREE_SECRET_KEY) ||
  usableSecret(localEnv.CASHFREE_SECRET_KEY) ||
  "";
const supabaseUrl =
  usableSecret(process.env.E2E_SUPABASE_URL) ||
  usableSecret(localEnv.NEXT_PUBLIC_SUPABASE_URL) ||
  usableSecret(pulled.NEXT_PUBLIC_SUPABASE_URL) ||
  "https://cvfklozxeiygvonbbgew.supabase.co";
const serviceRole =
  usableSecret(process.env.E2E_SRK) ||
  usableSecret(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  usableSecret(localEnv.SUPABASE_SERVICE_ROLE_KEY) ||
  "";

function vercelCurl(path, { method = "GET", body, headers = [], cookie = true } = {}) {
  const bodyFile = join(WORK, `body-${Date.now()}-${Math.random()}.json`);
  const respFile = join(WORK, `resp-${Date.now()}-${Math.random()}.txt`);
  const hdrFile = join(WORK, `hdr-${Date.now()}-${Math.random()}.txt`);
  // `--` prevents vercel CLI from eating curl short flags like `-S`.
  const args = [
    "vercel",
    "curl",
    path,
    "--deployment",
    DEPLOYMENT,
    "--",
    "-X",
    method,
    "-sS",
    "-D",
    hdrFile,
    "-o",
    respFile,
    "-w",
    "%{http_code}",
  ];
  for (const h of headers) {
    args.push("-H", h);
  }
  if (body !== undefined) {
    writeFileSync(bodyFile, JSON.stringify(body));
    args.push("-H", "Content-Type: application/json", "--data-binary", `@${bodyFile}`);
  }
  if (cookie) {
    args.push("-b", cookieFile, "-c", cookieFile);
  }
  const res = spawnSync("npx", args, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  try {
    if (existsSync(bodyFile)) unlinkSync(bodyFile);
  } catch {
    /* ignore */
  }
  let respText = "";
  let hdrText = "";
  try {
    if (existsSync(respFile)) respText = readFileSync(respFile, "utf8");
  } catch {
    /* ignore */
  }
  try {
    if (existsSync(hdrFile)) hdrText = readFileSync(hdrFile, "utf8");
  } catch {
    /* ignore */
  }
  try {
    if (existsSync(respFile)) unlinkSync(respFile);
    if (existsSync(hdrFile)) unlinkSync(hdrFile);
  } catch {
    /* ignore */
  }
  const codeFromWrite = String(res.stdout || "").trim().match(/(\d{3})\s*$/);
  const codeFromHdr = hdrText.match(/HTTP\/[\d.]+\s+(\d+)/);
  let json = null;
  try {
    json = JSON.parse(respText);
  } catch {
    const jsonMatch = scrub(respText).match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        json = JSON.parse(jsonMatch[0]);
      } catch {
        /* ignore */
      }
    }
  }
  let status = codeFromWrite
    ? Number(codeFromWrite[1])
    : codeFromHdr
      ? Number(codeFromHdr[1])
      : 0;
  if (!status) {
    if (json?.success === true || json?.session_token || json?.clinic || json?.order_id) {
      status = 200;
    } else if (json?.error || json?.success === false) {
      status = 400;
    } else if (res.status === 0 && respText) {
      status = 200;
    } else {
      status = res.status === 0 ? 500 : res.status || 500;
    }
  }
  return {
    status,
    json,
    raw: scrub(`${res.stdout || ""}\n${res.stderr || ""}\n${respText}`),
    ok: status >= 200 && status < 300 && json?.success !== false,
  };
}

function hashOtp(email, otp) {
  return createHash("sha256").update(`${email}:${otp}`).digest("hex");
}

function resolveOtp(email, hash) {
  for (let i = 100000; i < 1000000; i += 1) {
    const otp = String(i);
    if (hashOtp(email, otp) === hash) return otp;
  }
  return null;
}

async function fetchOtpHash(email) {
  if (!serviceRole || !supabaseUrl) return null;
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/email_otp_requests?email_normalized=eq.${encodeURIComponent(email)}&select=otp_hash&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const hash = rows?.[0]?.otp_hash;
  return typeof hash === "string" && hash && hash !== "INVALIDATED" ? hash : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function printSummary() {
  console.log("---RESULTS---");
  for (const r of results) {
    console.log(`${r.status}\t${r.step}\t${r.detail}`);
  }
}

async function paySandboxOrder(paymentSessionId) {
  if (!paymentSessionId) {
    return { ok: false, detail: "missing_session" };
  }
  const res = await fetch("https://sandbox.cashfree.com/pg/orders/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2025-01-01",
      ...(cashfreeAppId ? { "x-client-id": cashfreeAppId } : {}),
      ...(cashfreeSecret ? { "x-client-secret": cashfreeSecret } : {}),
    },
    body: JSON.stringify({
      payment_session_id: paymentSessionId,
      payment_method: {
        upi: {
          channel: "collect",
          upi_id: "testsuccess@gocash",
        },
      },
    }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  const paymentStatus = String(
    json?.payment_status || json?.cf_payment_id || json?.action || "",
  );
  return {
    ok: res.ok || /SUCCESS|PENDING|link|cf_payment/i.test(JSON.stringify(json || {})),
    status: res.status,
    paymentStatus,
    detail: res.ok ? "upi_collect_submitted" : `http_${res.status}`,
  };
}

async function main() {
  const ts = Date.now();
  const email = `skiplines.sandbox.e2e.${ts}@gmail.com`;
  console.log(`BASE=${BASE}`);
  console.log(`EMAIL_SET=yes`);
  console.log(`CRON_SECRET_SET=${cronSecret ? "yes" : "no"}`);
  console.log(`CASHFREE_KEYS_SET=${cashfreeAppId && cashfreeSecret ? "yes" : "no"}`);
  console.log(`SERVICE_ROLE_SET=${serviceRole ? "yes" : "no"}`);
  console.log(`SUPABASE_URL_SET=${supabaseUrl ? "yes" : "no"}`);

  // 1) OTP send
  const send = vercelCurl("/api/otp/send", {
    method: "POST",
    body: { email },
  });
  if (!send.ok) {
    const errMsg = String(send.json?.error || send.json?.message || "")
      .replace(/\b\d{6}\b/g, "<otp?>")
      .slice(0, 160);
    log("OTP send", "FAIL", `status=${send.status} err=${errMsg}`);
    printSummary();
    process.exit(1);
  }
  log(
    "OTP send",
    "PASS",
    `channel=${send.json?.channel ?? "unknown"} login=${send.json?.login}`,
  );

  // Resolve OTP: prefer API dev_otp (never logged), else E2E_OTP_HASH brute,
  // else state file hash written by operator/MCP.
  let otp = typeof send.json?.dev_otp === "string" ? send.json.dev_otp : null;
  const hashPath = join(process.cwd(), ".e2e-otp-hash.tmp");
  const statePath = join(process.cwd(), ".e2e-preview-state.json");
  writeFileSync(
    statePath,
    JSON.stringify({ email, base: BASE, phase: "otp_sent", cookieFile }),
  );

  if (!otp && process.env.E2E_OTP_HASH) {
    otp = resolveOtp(email, process.env.E2E_OTP_HASH);
  }
  if (!otp && existsSync(hashPath)) {
    const hash = readFileSync(hashPath, "utf8").trim();
    otp = resolveOtp(email, hash);
  }

  // Resolve via service-role REST (hash only; never logged)
  if (!otp && serviceRole) {
    for (let i = 0; !otp && i < 10; i += 1) {
      const hash = await fetchOtpHash(email);
      if (hash) {
        writeFileSync(hashPath, hash);
        otp = resolveOtp(email, hash);
        break;
      }
      await sleep(1000);
    }
  }

  // Brief wait loop for external hash writer (MCP)
  for (let i = 0; !otp && i < 15; i += 1) {
    await sleep(1000);
    if (existsSync(hashPath)) {
      const hash = readFileSync(hashPath, "utf8").trim();
      if (hash) otp = resolveOtp(email, hash);
    }
    if (process.env.E2E_OTP) {
      otp = process.env.E2E_OTP;
      break;
    }
  }

  if (!otp) {
    log("OTP resolve", "FAIL", "no_hash_or_dev_otp");
    printSummary();
    process.exit(2);
  }
  log("OTP resolve", "PASS", "resolved_in_process");

  // 2) OTP verify
  const verify = vercelCurl("/api/otp/verify", {
    method: "POST",
    body: { email, otp },
  });
  otp = null; // drop from memory ASAP
  if (!verify.ok || !verify.json?.session_token) {
    const keys =
      verify.json && typeof verify.json === "object"
        ? Object.keys(verify.json).join(",")
        : "no_json";
    log(
      "OTP verify",
      "FAIL",
      `status=${verify.status} keys=${keys} success=${verify.json?.success}`,
    );
    printSummary();
    process.exit(1);
  }
  const sessionToken = verify.json.session_token;
  log("OTP verify", "PASS", "session_issued");

  // 3) Registration / 1-minute trial
  const reg = vercelCurl("/api/clinics", {
    method: "POST",
    body: {
      doctor_name: "E2E Sandbox Doctor",
      clinic_name: `E2E Clinic ${ts}`,
      email,
      session_token: sessionToken,
      avg_time_per_patient: 10,
      consultation_fee: 500,
    },
  });
  const clinicId = reg.json?.clinic?.id;
  const trialEndsAt = reg.json?.clinic?.trial_ends_at;
  const subStatus = reg.json?.clinic?.subscription_status;
  if (!reg.ok || !clinicId) {
    log("Registration", "FAIL", `status=${reg.status}`);
    printSummary();
    process.exit(1);
  }
  const trialMs = trialEndsAt
    ? new Date(trialEndsAt).getTime() - Date.now()
    : -1;
  const trialOk =
    subStatus === "trialing" && trialMs > 0 && trialMs <= 120_000;
  log(
    "Registration 1-minute trial",
    trialOk ? "PASS" : "FAIL",
    `status=${subStatus} trial_ms_left≈${Math.round(trialMs)}`,
  );

  writeFileSync(
    statePath,
    JSON.stringify({
      email,
      clinicId,
      base: BASE,
      phase: "registered",
      cookieFile,
    }),
  );

  // 4) Dashboard/API access during trial
  const dashOk = vercelCurl(`/api/clinics/${clinicId}`);
  const meOk = vercelCurl("/api/auth/me");
  if (dashOk.ok && meOk.json?.authenticated) {
    log("Trial dashboard/API access", "PASS", `clinic=${Boolean(dashOk.json?.clinic)}`);
  } else {
    log(
      "Trial dashboard/API access",
      "FAIL",
      `dash=${dashOk.status} me=${meOk.status}`,
    );
  }

  // 5) Wait for trial expiry
  const waitTrial = Math.max(trialMs + 3000, 65_000);
  console.log(`WAITING_TRIAL_MS=${waitTrial}`);
  await sleep(waitTrial);

  const lockedAfterTrial = vercelCurl(`/api/clinics/${clinicId}`);
  const trialLockPass =
    lockedAfterTrial.status === 403 ||
    lockedAfterTrial.json?.code === "SUBSCRIPTION_REQUIRED";
  log(
    "Trial expiry dashboard/API lock",
    trialLockPass ? "PASS" : "FAIL",
    `status=${lockedAfterTrial.status} code=${lockedAfterTrial.json?.code ?? ""}`,
  );

  // 6) Create ₹1 sandbox order (server amount only)
  const order = vercelCurl("/api/cashfree/create-order", {
    method: "POST",
    body: { clinic_id: clinicId, amount: 99999 },
  });
  const amount = order.json?.amount;
  const orderId = order.json?.order_id;
  const paymentSessionId = order.json?.payment_session_id;
  const amountPass =
    order.ok &&
    amount === 1 &&
    order.json?.cashfree_mode === "sandbox" &&
    order.json?.subscription_test_mode === true;
  log(
    "Create ₹1 sandbox order (server amount)",
    amountPass ? "PASS" : "FAIL",
    `status=${order.status} amount=${amount} mode=${order.json?.cashfree_mode}`,
  );

  // 7) Sandbox payment
  let pay = { ok: false, detail: "skipped" };
  if (amountPass && paymentSessionId) {
    pay = await paySandboxOrder(paymentSessionId);
  }
  log(
    "Sandbox payment",
    pay.ok ? "PASS" : "FAIL",
    `${pay.detail}${pay.status ? ` http=${pay.status}` : ""}`,
  );

  // 8) Poll verify-payment / webhook activation
  let activated = false;
  let webhookSeen = false;
  for (let i = 0; i < 24; i += 1) {
    await sleep(5000);
    const v = vercelCurl("/api/cashfree/verify-payment", {
      method: "POST",
      body: { clinic_id: clinicId, order_id: orderId },
    });
    if (v.ok && (v.json?.status === "active" || /unlock|activated|success/i.test(v.json?.message || ""))) {
      activated = true;
      break;
    }
    const dash = vercelCurl(`/api/clinics/${clinicId}`);
    if (dash.ok && dash.json?.clinic?.subscription_status === "active") {
      activated = true;
      webhookSeen = true;
      break;
    }
  }
  log(
    "Webhook/verify activation",
    activated ? "PASS" : "FAIL",
    activated ? (webhookSeen ? "dashboard_active" : "verify_active") : "not_active",
  );

  // 9) Dashboard unlock
  const unlocked = vercelCurl(`/api/clinics/${clinicId}`);
  log(
    "Dashboard unlock after payment",
    unlocked.ok ? "PASS" : "FAIL",
    `status=${unlocked.status} sub=${unlocked.json?.clinic?.subscription_status ?? ""}`,
  );

  // 10) Wait paid 1-minute expiry
  const paidExpires = unlocked.json?.clinic?.subscription_expires_at;
  const paidMs = paidExpires
    ? new Date(paidExpires).getTime() - Date.now()
    : 65_000;
  const waitPaid = Math.max(paidMs + 3000, 65_000);
  console.log(`WAITING_PAID_MS=${waitPaid}`);
  await sleep(waitPaid);

  const lockedAfterPaid = vercelCurl(`/api/clinics/${clinicId}`);
  const paidLockPass =
    lockedAfterPaid.status === 403 ||
    lockedAfterPaid.json?.code === "SUBSCRIPTION_REQUIRED";
  log(
    "Paid expiry dashboard/API lock",
    paidLockPass ? "PASS" : "FAIL",
    `status=${lockedAfterPaid.status}`,
  );

  // 11) Reconciliation marks expired
  let reconPass = false;
  let reconDetail = "no_cron_secret";
  if (cronSecret) {
    const recon = vercelCurl("/api/jobs/reconcile-subscriptions", {
      method: "POST",
      headers: [`Authorization: Bearer ${cronSecret}`],
      body: {},
      cookie: false,
    });
    reconDetail = `status=${recon.status} expired_subs=${recon.json?.expired_subscriptions ?? "?"}`;
    reconPass = recon.ok;
  }
  log("Reconciliation marks expired", reconPass ? "PASS" : "FAIL", reconDetail);

  writeFileSync(
    statePath,
    JSON.stringify({
      email,
      clinicId,
      base: BASE,
      phase: "done",
      cleanup: true,
    }),
  );

  printSummary();
  const failed = results.some((r) => r.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

main().catch(() => {
  console.error("FATAL_WITHOUT_SECRETS");
  printSummary();
  process.exit(1);
});
