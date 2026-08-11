-- Lock down public write access on core tables.
-- Reads remain available to anon for live tracker Realtime subscriptions.
-- All writes must go through the service role (API routes using createAdminClient).

-- Clinics: remove permissive write policies
drop policy if exists "clinics_insert" on public.clinics;
drop policy if exists "clinics_update" on public.clinics;

alter table public.clinics enable row level security;

-- Tokens: enable RLS and remove any permissive write policies
alter table public.tokens enable row level security;

drop policy if exists "tokens_insert" on public.tokens;
drop policy if exists "tokens_update" on public.tokens;
drop policy if exists "tokens_delete" on public.tokens;

drop policy if exists "tokens_public_select" on public.tokens;
create policy "tokens_public_select"
  on public.tokens
  for select
  to anon, authenticated
  using (true);

-- Notification logs: remove permissive write policy
drop policy if exists "notification_logs_insert" on public.notification_logs;

alter table public.notification_logs enable row level security;

drop policy if exists "notification_logs_public_select" on public.notification_logs;
create policy "notification_logs_public_select"
  on public.notification_logs
  for select
  to anon, authenticated
  using (true);

-- Legacy queue_entries table (if present from early migrations)
drop policy if exists "queue_insert" on public.queue_entries;
drop policy if exists "queue_update" on public.queue_entries;

-- Revoke direct SQL write grants from browser-facing roles
revoke insert, update, delete on table public.clinics from anon, authenticated;
revoke insert, update, delete on table public.tokens from anon, authenticated;
revoke insert, update, delete on table public.notification_logs from anon, authenticated;

do $$
begin
  if to_regclass('public.queue_entries') is not null then
    execute 'revoke insert, update, delete on table public.queue_entries from anon, authenticated';
  end if;
end $$;
