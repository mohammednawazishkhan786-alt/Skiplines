-- Phone OTP verification for doctor registration

create table if not exists public.phone_otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists phone_otp_requests_phone_idx
  on public.phone_otp_requests (phone_normalized, created_at desc);

alter table public.phone_otp_requests enable row level security;

create policy "phone_otp_service_only"
  on public.phone_otp_requests
  for all
  using (false)
  with check (false);
