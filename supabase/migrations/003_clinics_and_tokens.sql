-- Skiplines canonical schema (applied via Supabase MCP)
-- clinics + tokens tables

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  doctor_name text not null,
  clinic_name text not null,
  email text not null,
  phone text not null,
  avg_time_per_patient integer not null check (avg_time_per_patient > 0),
  current_token integer not null default 0,
  consultation_fee numeric(10, 2) default 500,
  clinic_hours text default 'Mon-Sat 9:00 AM - 8:00 PM',
  google_review_link text,
  whatsapp_number text,
  razorpay_subscription_id text,
  subscription_status text default 'trial',
  trial_ends_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  token_number integer not null,
  queue_position integer not null,
  status text not null default 'waiting' check (status in ('waiting', 'called', 'completed')),
  patient_phone text,
  patient_name text,
  is_emergency boolean not null default false,
  is_late boolean not null default false,
  review_sent boolean not null default false,
  confirmed_at timestamptz,
  estimated_call_at timestamptz,
  completed_at timestamptz,
  late_shift_count integer not null default 0,
  confirmation_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (clinic_id, token_number)
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete cascade,
  token_id uuid references public.tokens (id) on delete set null,
  phone text not null,
  type text not null,
  message text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);
