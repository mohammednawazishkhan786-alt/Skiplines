-- Skiplines: clinics and patient queue tables
-- Run this in the Supabase SQL Editor or via `supabase db push`

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  doctor_name text not null,
  clinic_name text not null,
  email text not null,
  phone text not null,
  avg_time_per_patient integer not null check (avg_time_per_patient > 0),
  current_token integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  token_number integer not null,
  status text not null default 'waiting' check (status in ('waiting', 'called', 'completed')),
  created_at timestamptz not null default now(),
  unique (clinic_id, token_number)
);

create index if not exists queue_entries_clinic_status_idx
  on public.queue_entries (clinic_id, status, token_number);

alter table public.clinics enable row level security;
alter table public.queue_entries enable row level security;

create policy "clinics_select" on public.clinics for select using (true);
create policy "clinics_insert" on public.clinics for insert with check (true);
create policy "clinics_update" on public.clinics for update using (true);

create policy "queue_select" on public.queue_entries for select using (true);
create policy "queue_insert" on public.queue_entries for insert with check (true);
create policy "queue_update" on public.queue_entries for update using (true);
