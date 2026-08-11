# Skiplines — Disaster Recovery

Last updated: 2026-08-11  
Project: Supabase `cvfklozxeiygvonbbgew` (Skiplines) · Region `ap-south-1`  
App host: Vercel project `skiplines-app` · Canonical URL https://www.skiplines.in

## Backup strategy

| Layer | What | Notes |
|-------|------|-------|
| Supabase managed backups | Automatic daily backups of the Postgres project | Confirm retention/PITR in Supabase Dashboard → Project Settings → Database → Backups. Exact retention depends on the active Supabase plan. |
| Schema as code | `supabase/migrations/001`–`016` in git | Source of truth for schema evolution. |
| App releases | Vercel deployment history | Instant rollback to prior Production deployment. |
| Secrets | Vercel env (Production / Preview) + Supabase dashboard | Never stored in git. |

**Status:** Managed backup capability is assumed present for an ACTIVE_HEALTHY hosted project; **exact PITR window and retention must be confirmed in the Supabase Dashboard** by a project owner (marked 🟡 until screenshot/confirmation is filed).

## RPO / RTO targets

| Metric | Target | How |
|--------|--------|-----|
| **RPO** (data loss tolerance) | ≤ 24h (or PITR window if Pro+ PITR enabled) | Restore from latest Supabase backup / PITR |
| **RTO** (time to recover) | ≤ 4 hours for app+DB restore to known-good | Parallel: Vercel rollback + Supabase restore to branch / new project |

These are operational targets, not contractual SLAs.

## Credentials required

- Supabase org owner/admin (Dashboard access)
- Vercel project admin (deploy + env)
- Cashfree merchant dashboard (webhook URL + keys if rotating)
- DNS admin for `skiplines.in` (only if cutover required)

## Restore procedure (NON-PRODUCTION first)

**Never restore over Production without an explicit incident command.**

1. In Supabase Dashboard, create a **Branch** or restore backup into a **new project**.
2. Point a Vercel **Preview** deployment at the restored DB URL + anon key + service role (Preview env only).
3. Run smoke tests: OTP send/verify, join queue, doctor dashboard, create-order (sandbox if Preview test mode).
4. Only after sign-off, plan Production cutover (maintenance window).

## Production incident rollback (application)

1. Vercel → Deployments → promote previous known-good Production deployment (`dpl_*`).
2. Do **not** enable `SUBSCRIPTION_TEST_MODE` on Production.
3. Confirm Pricing: ₹999 / 7-day trial unchanged.
4. Re-run auth + queue smoke checks on https://www.skiplines.in.

## Migration recovery

1. Prefer forward-fix migrations (new `017_*.sql`) over editing applied history.
2. For `016_security_lockdown_public_access.sql`, reverse only with an approved rollback migration that re-grants intentional public surfaces — **do not** re-open OTP or PII SELECT to anon.
3. Keep `service_role` grants intact so API routes continue to work.

## Cashfree / webhooks after restore

1. Confirm Production webhook URL: `https://www.skiplines.in/api/webhooks/cashfree` (and `/api/cashfree/webhook` if still aliased).
2. Confirm signature secret matches env `CASHFREE_SECRET_KEY`.
3. Reconcile subscriptions via authenticated cron: `POST /api/jobs/reconcile-subscriptions` with `Authorization: Bearer $CRON_SECRET`.

## Who does what

| Role | Responsibility |
|------|----------------|
| Eng on-call | Detect, Vercel rollback, smoke tests |
| DB owner | Supabase restore / branch |
| Founder | Customer comms, approve Production restore |

## Restore drill status

- Separate-branch restore drill: **not executed in this remediation** (requires Dashboard UI / plan confirmation).
- Track as follow-up: perform quarterly restore drill to a Preview branch and attach evidence to this doc.
