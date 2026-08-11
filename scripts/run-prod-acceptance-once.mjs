/**
 * One-shot LIVE production acceptance. Never prints OTP, session_token, payment_session_id, or secrets.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "https://www.skiplines.in";
const EMAIL = process.env.E2E_TEST_EMAIL?.trim();
const HASH = process.env.E2E_OTP_HASH?.trim();
if (!EMAIL?.includes("skiplines.final.acceptance.") || !HASH) {
  console.error("Set E2E_TEST_EMAIL and E2E_OTP_HASH");
  process.exit(2);
}

const WORK = mkdtempSync(join(tmpdir(), "prod-acc-"));
const cookieFile = join(WORK, "cookies.txt");
writeFileSync(cookieFile, "");
const results = [];
const log = (step, status, detail = "") => {
  results.push({ step, status, detail });
  console.log(`${status}: ${step}${detail ? ` — ${detail}` : ""}`);
};

function scrub(s) {
  return String(s || "")
    .replace(/"session_token"\s*:\s*"[^"]+"/gi, '"session_token":"<redacted>"')
    .replace(/"payment_session_id"\s*:\s*"[^"]+"/gi, '"payment_session_id":"<redacted>"')
    .replace(/\b\d{6}\b/g, "<otp?>");
}

function curl(path, { method = "GET", body, save = false, send = false } = {}) {
  const bodyFile = body ? join(WORK, `b-${Date.now()}.json`) : null;
  if (bodyFile) writeFileSync(bodyFile, JSON.stringify(body));
  const hasCookies = readFileSync(cookieFile, "utf8")
    .split("\n")
    .some((l) => l && !l.startsWith("#"));
  const args = [
    "-sS",
    "-w",
    "\nHTTP:%{http_code}",
    "-X",
    method,
    ...(save ? ["-c", cookieFile] : []),
    ...(send && hasCookies ? ["-b", cookieFile] : []),
    "-H",
    "Content-Type: application/json",
    ...(bodyFile ? ["--data-binary", `@${bodyFile}`] : []),
    `${BASE}${path}`,
  ];
  const r = spawnSync("curl.exe", args, { encoding: "utf8" });
  if (bodyFile) unlinkSync(bodyFile);
  const out = (r.stdout || "") + (r.stderr || "");
  const m = out.match(/HTTP:(\d{3})\s*$/);
  const status = m ? Number(m[1]) : r.status || 0;
  const text = out.replace(/\nHTTP:\d+\s*$/, "").trim();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    const j = text.match(/\{[\s\S]*\}/);
    if (j) {
      try {
        json = JSON.parse(j[0]);
      } catch {
        /* ignore */
      }
    }
  }
  return { status, json, preview: scrub(text).slice(0, 120) };
}

let otp = null;
for (let i = 100000; i < 1000000; i++) {
  const o = String(i);
  if (createHash("sha256").update(`${EMAIL}:${o}`).digest("hex") === HASH) {
    otp = o;
    break;
  }
}
if (!otp) {
  log("OTP resolve", "FAIL", "hash_mismatch");
  process.exit(2);
}
log("OTP resolve", "PASS", "ok");

const verify = curl("/api/otp/verify", {
  method: "POST",
  body: { email: EMAIL, otp },
});
otp = null;
if (verify.status !== 200 || !verify.json?.session_token) {
  log("OTP verify", "FAIL", `http=${verify.status} preview=${verify.preview}`);
  process.exit(1);
}
log("OTP verify", "PASS", "session_issued");
const sessionToken = verify.json.session_token;

const ts = Date.now();
const reg = curl("/api/clinics", {
  method: "POST",
  save: true,
  body: {
    doctor_name: "Final Acceptance Test Doctor",
    clinic_name: `FINAL_ACCEPTANCE_TEST_${ts}`,
    email: EMAIL,
    session_token: sessionToken,
    avg_time_per_patient: 10,
    consultation_fee: 500,
  },
});
const clinicId = reg.json?.clinic?.id;
const trialEndsAt = reg.json?.clinic?.trial_ends_at;
const subAmount = reg.json?.clinic?.subscription_amount;
const trialDays =
  trialEndsAt ? (new Date(trialEndsAt).getTime() - Date.now()) / 86400000 : -1;
log(
  "Registration 7-day trial",
  reg.status === 201 &&
    reg.json?.clinic?.subscription_status === "trialing" &&
    trialDays >= 6.9 &&
    trialDays <= 7.1 &&
    subAmount === 999
    ? "PASS"
    : "FAIL",
  `http=${reg.status} days≈${trialDays.toFixed(2)} amount=${subAmount}`,
);

const me = curl("/api/auth/me", { send: true, save: true });
log(
  "Doctor session",
  me.json?.authenticated && me.json?.clinic_id === clinicId ? "PASS" : "FAIL",
  `auth=${me.json?.authenticated}`,
);

const order = curl("/api/cashfree/create-order", {
  method: "POST",
  send: true,
  save: true,
  body: { clinic_id: clinicId, order_amount: 1, amount: 1 },
});
const leak = /cfsk_|CASHFREE_SECRET/i.test(JSON.stringify(order.json || {}));
log(
  "Create-order success",
  order.status === 200 && order.json?.success ? "PASS" : "FAIL",
  `http=${order.status}`,
);
log(
  "payment_session_id + order_id",
  order.json?.payment_session_id && order.json?.order_id ? "PASS" : "FAIL",
  "present",
);
log(
  "Amount ₹999",
  order.json?.amount === 999 ? "PASS" : "FAIL",
  `amount=${order.json?.amount}`,
);
log(
  "Production mode",
  order.json?.cashfree_mode === "production" &&
    order.json?.subscription_test_mode === false
    ? "PASS"
    : "FAIL",
  `mode=${order.json?.cashfree_mode} test=${order.json?.subscription_test_mode}`,
);
log("No secrets in response", leak ? "FAIL" : "PASS", leak ? "leak" : "clean");
console.log(`CLINIC_ID_FOR_CLEANUP=${clinicId}`);
console.log("---SUMMARY---");
for (const r of results) console.log(`${r.status}\t${r.step}\t${r.detail}`);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
