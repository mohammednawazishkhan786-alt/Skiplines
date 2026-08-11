-- Production hardening: RLS write lockdown, subscription billing columns, payment audit tables.

-- ---------------------------------------------------------------------------
-- RLS: remove permissive write policies (idempotent)
-- ---------------------------------------------------------------------------
drop policy if exists "clinics_insert" on public.clinics;
drop policy if exists "clinics_update" on public.clinics;
drop policy if exists "clinics_delete" on public.clinics;

drop policy if exists "tokens_insert" on public.tokens;
drop policy if exists "tokens_update" on public.tokens;
drop policy if exists "tokens_delete" on public.tokens;

drop policy if exists "notification_logs_insert" on public.notification_logs;
drop policy if exists "notification_logs_update" on public.notification_logs;
drop policy if exists "notification_logs_delete" on public.notification_logs;

alter table public.clinics enable row level security;
alter table public.tokens enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "tokens_public_select" on public.tokens;
create policy "tokens_public_select"
  on public.tokens
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on table public.clinics from anon, authenticated;
revoke insert, update, delete on table public.tokens from anon, authenticated;
revoke insert, update, delete on table public.notification_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Subscription billing columns on clinics (source of truth for access checks)
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists next_billing_date timestamptz,
  add column if not exists last_payment_at timestamptz,
  add column if not exists subscription_amount numeric(10, 2) default 999,
  add column if not exists subscription_currency text default 'INR',
  add column if not exists payment_provider text default 'cashfree',
  add column if not exists subscription_plan text default 'monthly_999',
  add column if not exists cancelled_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create index if not exists clinics_trial_ends_at_idx
  on public.clinics (trial_ends_at);

create index if not exists clinics_subscription_expires_at_idx
  on public.clinics (subscription_expires_at);

create index if not exists clinics_next_billing_date_idx
  on public.clinics (next_billing_date);

-- ---------------------------------------------------------------------------
-- Payment transactions (idempotency + audit)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  provider text not null default 'cashfree',
  provider_order_id text not null,
  provider_payment_id text,
  amount numeric(10, 2) not null,
  currency text not null default 'INR',
  status text not null default 'pending',
  event_type text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id)
);

create index if not exists payment_transactions_clinic_id_idx
  on public.payment_transactions (clinic_id);

alter table public.payment_transactions enable row level security;

-- ---------------------------------------------------------------------------
-- Webhook events (idempotency)
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cashfree',
  event_id text not null,
  event_type text not null,
  clinic_id uuid references public.clinics (id) on delete set null,
  provider_order_id text,
  payload jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists webhook_events_clinic_id_idx
  on public.webhook_events (clinic_id);

alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Distributed rate-limit buckets (serverless-safe)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;
