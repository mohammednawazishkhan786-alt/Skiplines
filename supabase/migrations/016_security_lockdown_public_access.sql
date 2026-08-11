-- 016: Security lockdown — OTP RLS, revoke public privileges, deny base-table PII SELECT.
-- Reversible notes at bottom. Does NOT weaken existing write lockdown.
-- Public queue continues via Next.js APIs using service_role (admin client).

-- ---------------------------------------------------------------------------
-- 1) email_otp_requests: enable RLS + revoke public access
-- ---------------------------------------------------------------------------
alter table public.email_otp_requests enable row level security;

drop policy if exists "email_otp_service_only" on public.email_otp_requests;
-- Explicit deny for public roles (service_role bypasses RLS)
create policy "email_otp_deny_public"
  on public.email_otp_requests
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.email_otp_requests from anon, authenticated;

grant select, insert, update, delete
  on table public.email_otp_requests
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) phone_otp_requests: revoke public grants (RLS already deny)
-- ---------------------------------------------------------------------------
revoke all on table public.phone_otp_requests from anon, authenticated;

grant select, insert, update, delete
  on table public.phone_otp_requests
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) clinics / tokens / notification_logs: remove open SELECT policies
--    Public tracker uses API + polling; no anon SELECT on base tables.
-- ---------------------------------------------------------------------------
drop policy if exists "clinics_select" on public.clinics;
drop policy if exists "tokens_public_select" on public.tokens;
drop policy if exists "tokens_select" on public.tokens;
drop policy if exists "notification_logs_select" on public.notification_logs;
drop policy if exists "notification_logs_public_select" on public.notification_logs;

-- Keep service_role policies if present; ensure grants
revoke all on table public.clinics from anon, authenticated;
revoke all on table public.tokens from anon, authenticated;
revoke all on table public.notification_logs from anon, authenticated;

grant select, insert, update, delete on table public.clinics to service_role;
grant select, insert, update, delete on table public.tokens to service_role;
grant select, insert, update, delete on table public.notification_logs to service_role;

-- ---------------------------------------------------------------------------
-- 4) Sensitive internal tables: revoke public; RLS on; service_role only
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;
alter table public.webhook_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

revoke all on table public.payment_transactions from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.rate_limit_buckets from anon, authenticated;

grant select, insert, update, delete on table public.payment_transactions to service_role;
grant select, insert, update, delete on table public.webhook_events to service_role;
grant select, insert, update, delete on table public.rate_limit_buckets to service_role;

-- ---------------------------------------------------------------------------
-- 5) Public-safe views (explicit allowlist columns only) — optional REST surface
--    Not granted to anon by default; reserved for future tightly scoped use.
--    Queue/tracker MUST use Next.js APIs (service_role), not these views, for now.
-- ---------------------------------------------------------------------------
create or replace view public.public_clinic_queue
with (security_invoker = true)
as
select
  id,
  doctor_name,
  clinic_name,
  avg_time_per_patient,
  current_token
from public.clinics;

create or replace view public.public_token_status
with (security_invoker = true)
as
select
  id,
  clinic_id,
  token_number,
  queue_position,
  status,
  is_emergency,
  is_late,
  estimated_call_at,
  completed_at,
  late_shift_count,
  created_at
from public.tokens;

revoke all on table public.public_clinic_queue from anon, authenticated;
revoke all on table public.public_token_status from anon, authenticated;
grant select on table public.public_clinic_queue to service_role;
grant select on table public.public_token_status to service_role;

-- ---------------------------------------------------------------------------
-- 6) Fix mutable search_path on clinic id guard (advisor WARN)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_clinic_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.id is distinct from new.id then
    raise exception 'clinic_id cannot be changed once assigned';
  end if;
  return new;
end;
$$;

-- Reversibility (manual):
--   - Recreate previous open SELECT policies only if intentionally rolling back privacy.
--   - Prefer fixing application paths over re-opening base-table SELECT to anon.
