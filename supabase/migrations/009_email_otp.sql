-- Email OTP verification for doctor login and registration

create table if not exists public.email_otp_requests (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  session_token text,
  created_at timestamptz not null default now()
);

create index if not exists email_otp_requests_email_idx
  on public.email_otp_requests (email_normalized, created_at desc);

create index if not exists email_otp_requests_session_token_idx
  on public.email_otp_requests (session_token)
  where session_token is not null;

alter table public.email_otp_requests enable row level security;

create policy "email_otp_service_only"
  on public.email_otp_requests
  for all
  using (false)
  with check (false);

create unique index if not exists clinics_email_unique_idx
  on public.clinics (lower(trim(email)));
