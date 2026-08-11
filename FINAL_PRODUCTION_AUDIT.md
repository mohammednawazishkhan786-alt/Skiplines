# FINAL PRODUCTION AUDIT — Skiplines

Audit date: **2026-08-11**  
Production URL: **https://www.skiplines.in**  
Production deployment: **`dpl_8ptQdjVK6QuvErNTvSYQStfSGSWA`**  
Preview verification deployment: **`dpl_FSdSJTEJcCYMQctrcxkSZ6HgVdZu`**  
DB migration applied: **`016_security_lockdown_public_access`**  
Baseline remediated from audit against `dpl_9EPwbDZj1fwih4jmcN4pDtLuCELP`

Status legend: 🟢 VERIFIED COMPLETE · 🟡 UNVERIFIED / NEEDS EXTERNAL CONFIRMATION · 🔴 FAILED / MUST FIX

---

## Executive summary

| Gate | Result |
|------|--------|
| CRITICAL security issues remaining | **0** |
| HIGH authz/PII/OTP exposure remaining | **0** |
| Tests | **70/70 pass** (67 prior + 3 new sanitization/constants) |
| Build / tsc / lint | **PASS** |
| `SUBSCRIPTION_TEST_MODE` on Production | **Not present** |
| Production pricing | **₹999 / 7-day trial** (code + env) |
| Anon PostgREST OTP/PII | **DENIED (401) LIVE** |
| Production OTP send | **WORKS LIVE** |
| robots.txt / sitemap.xml | **200 LIVE** |
| Security headers | **Present LIVE** |

**Verdict: 🟡 READY WITH WARNINGS** — critical/high database and API privacy blockers from the prior audit are fixed and verified. Remaining items are non-blocking verification gaps (DR drill, CWV field data, full dual-session IDOR LIVE, Cashfree autopay forever, axios vendor residual).

---

## 1. Frontend

🟢 Pages load; legal pages present; 404 present; live tracker polls sanitized API (no base-table Realtime).  
🟡 Full multi-device visual QA / Lighthouse UX not re-run end-to-end in browser automation this pass.

## 2. Backend/API

🟢 Doctor routes unauthorized → Unauthorized; queue miss → Token not found; create-order unauth denied; jobs unauth denied.  
🟢 Public queue/clinic GET paths use admin client + public field allowlists.  
🟢 Join/late/emergency patient routes return `toPublicToken`.  
🟡 Exhaustive CSRF matrix for cookie POSTs not instrumented (SameSite=lax mitigates).

## 3. Authentication

🟢 OTP send LIVE on Production after lockdown.  
🟢 Cookie flags HttpOnly / Secure / SameSite=lax.  
🟢 OTP hashing + rate limits preserved (code + prior tests).  
🟡 Full wrong/expired OTP LIVE matrix not re-executed this pass (covered by unit tests + prior Preview E2E).

## 4. Authorization/IDOR

🟢 Unauthenticated clinic access denied LIVE.  
🟢 `requireDoctorAuth` / subscription guard remain on doctor mutations.  
🟡 Dual-doctor LIVE cross-clinic cookie test not re-run this session (code path unchanged/green).

## 5. Supabase/RLS

🟢 `email_otp_requests` RLS enabled; anon DML/SELECT → **401 LIVE**.  
🟢 `clinics` / `tokens` / `notification_logs` anon SELECT of PII → **401 LIVE**.  
🟢 Sensitive tables grants revoked from anon/authenticated; service_role retained.  
🟢 Security Advisor: prior ERROR lints for OTP RLS **cleared**; remaining INFO = RLS on with no policies (intentional deny for public roles).

## 6. Patient privacy

🟢 Anon cannot read `patient_phone` via REST LIVE.  
🟢 Public API responses sanitized via `toPublicToken` / `PUBLIC_*_SELECT`.  
🟢 Doctor dashboard still receives patient contact fields via authenticated admin API (intentional).

## 7. OTP security

🟢 Anon cannot SELECT `otp_hash` / `session_token` LIVE.  
🟢 Anon INSERT/UPDATE/DELETE denied LIVE.  
🟢 Production OTP send works via service_role path.

## 8. Queue

🟢 Tracker uses API polling every 4s (privacy-preserving).  
🟢 Queue GET uses service_role + public selects.  
🟡 Join → 201 sanitized response not LIVE-tested against an open clinic this pass (unit sanitization tests added).

## 9. Trial/subscription

🟢 Production constants: 7-day trial, ₹999 (`PRODUCTION_*`, tests assert test mode off).  
🟢 `SUBSCRIPTION_TEST_MODE` absent from Production env listing.  
🟡 Production wall-clock 7-day expiry not waited; Preview 1-minute lifecycle previously verified.

## 10. Cashfree

🟢 Server-controlled amount; client amount ignored (code + tests).  
🟢 Webhook signature + amount + idempotency unit-tested.  
🟢 Prior Preview sandbox lifecycle PASS.  
🟡 **Automatic monthly UPI autopay “forever without repurchase”** is not claimed complete — primary path is paid period + expiry lock + re-purchase/`create-order`. Subscription APIs exist but indefinite autopay config is **not LIVE-proven**.  
⚠️ Real ₹999 Production payment **not run** (by policy).

## 11. Webhooks

🟢 Handler verifies signature; activation rejects wrong amount; duplicate events treated as duplicate (tests).  
🟡 Production webhook delivery not re-injected this pass.

## 12. Cron

🟢 Unauthenticated reconcile → Unauthorized LIVE.  
🟢 Schedule in `vercel.json` unchanged.  
🟡 Authenticated Production reconcile not force-invoked this pass.

## 13. Security headers

🟢 LIVE on Production: HSTS, CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.

## 14. SEO

🟢 `/robots.txt` → 200; `/sitemap.xml` → 200.  
🟢 Private routes noindex via layouts + robots disallow.  
🟢 Canonical host www preserved.

## 15. Accessibility

🟢 Login: label `htmlFor`, focus-visible rings, `role="alert"` on errors.  
🟡 Full WCAG 2.2 AA audit not completed across all pages.

## 16. Performance

🟡 No new CWV field measurements. Advisors show INFO unindexed FKs / unused indexes — not changed (non-critical).

## 17. Dependencies

🟡 axios highs via `cashfree-pg` — **no upstream fix**; documented in `docs/DEPENDENCY_RISKS.md` with monitoring plan. Not force-upgraded.

## 18. Testing

🟢 `npm test` → 70 pass  
🟢 `npm run build` → PASS (includes robots/sitemap)  
🟢 `npx tsc --noEmit` → PASS  
🟢 `npm run lint` → PASS  

## 19. DevOps

🟢 Preview then Production deploy completed.  
🟢 Production alias https://www.skiplines.in  
🟢 No Production `SUBSCRIPTION_TEST_MODE`

## 20. Backup/DR

🟡 Documented in `docs/DISASTER_RECOVERY.md` with RPO/RTO targets.  
🟡 Actual restore drill to a separate branch **not executed** — needs Supabase Dashboard owner confirmation of backup/PITR retention.

## 21. Legal pages

🟢 privacy / terms / refund / contact / data-deletion return 200 (prior + sitemap).

## 22. Production environment

🟢 Cashfree production mode vars present historically; test mode unset.  
🟢 Service-role not exposed as `NEXT_PUBLIC_*`.

## 23. Final score (honest)

| Category | Score |
|----------|------:|
| Frontend | 12/15 |
| Backend/API | 13/15 |
| Auth | 9/10 |
| Database/RLS | 9/10 |
| Queue | 9/10 |
| Subscription/Trial | 8/10 |
| Payment/Webhooks | 8/10 |
| Security | 9/10 |
| Performance | 3/5 |
| SEO/A11Y/UX | 4/5 |
| **TOTAL** | **84/100** |

---

## Remediation delivered

| Item | Evidence |
|------|----------|
| OTP RLS + revoke | Migration 016 + LIVE 401 |
| Clinic/token PII lockdown | Migration 016 + LIVE 401; tracker polling |
| Grants least privilege | Migration 016 |
| Join/late/emergency sanitization | Route updates + unit tests |
| Security headers | `next.config.ts` + LIVE headers |
| SEO robots/sitemap | `app/robots.ts`, `app/sitemap.ts` + LIVE 200 |
| DR doc | `docs/DISASTER_RECOVERY.md` |
| Dependency risk doc | `docs/DEPENDENCY_RISKS.md` |
| Pre-remediation inventory | `AUDIT_BEFORE_REMEDIATION.md` |

---

## Remaining non-blocking follow-ups

1. Confirm Supabase backup/PITR retention in Dashboard; run quarterly restore drill → update DR doc.  
2. Track Cashfree SDK release fixing nested axios.  
3. Optional: LIVE dual-clinic IDOR cookie test in Preview.  
4. Optional: CWV measurement on mobile.  
5. Clarify product expectation for Cashfree **autopay** vs repurchase-on-expiry.

---

## STOP

No further changes after this report without explicit approval.
