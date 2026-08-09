-- Skiplines v2: WhatsApp queue, emergency priority, billing, reviews

alter table public.clinics
  add column if not exists consultation_fee numeric(10, 2) default 500,
  add column if not exists clinic_hours text default 'Mon-Sat 9:00 AM - 8:00 PM',
  add column if not exists google_review_url text,
  add column if not exists whatsapp_number text,
  add column if not exists razorpay_subscription_id text,
  add column if not exists subscription_status text default 'trial',
  add column if not exists trial_ends_at timestamptz default (now() + interval '7 days');

alter table public.queue_entries
  add column if not exists patient_phone text,
  add column if not exists patient_name text,
  add column if not exists queue_position integer,
  add column if not exists is_emergency boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists estimated_call_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists review_sent boolean not null default false,
  add column if not exists late_shift_count integer not null default 0,
  add column if not exists confirmation_sent boolean not null default false;

create index if not exists queue_entries_clinic_position_idx
  on public.queue_entries (clinic_id, status, queue_position);

create index if not exists queue_entries_review_idx
  on public.queue_entries (status, completed_at, review_sent)
  where status = 'completed' and review_sent = false;

create index if not exists queue_entries_confirmation_idx
  on public.queue_entries (status, estimated_call_at, confirmation_sent)
  where status = 'waiting' and confirmation_sent = false;

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete cascade,
  queue_entry_id uuid references public.queue_entries (id) on delete set null,
  phone text not null,
  type text not null,
  message text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.notification_logs enable row level security;
create policy "notification_logs_select" on public.notification_logs for select using (true);
create policy "notification_logs_insert" on public.notification_logs for insert with check (true);

-- Backfill queue_position for existing rows
update public.queue_entries
set queue_position = token_number
where queue_position is null;

alter table public.queue_entries
  alter column queue_position set not null;

-- Enable realtime for live tracker
alter publication supabase_realtime add table public.queue_entries;
alter publication supabase_realtime add table public.clinics;
