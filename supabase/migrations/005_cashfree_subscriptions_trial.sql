-- Cashfree Subscriptions + trial abuse prevention by mobile number

alter table public.clinics
  add column if not exists phone_normalized text,
  add column if not exists cashfree_subscription_id text,
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists trial_started_at timestamptz;

update public.clinics
set phone_normalized = right(regexp_replace(phone, '\D', '', 'g'), 10)
where phone_normalized is null
  and length(regexp_replace(phone, '\D', '', 'g')) >= 10;

create index if not exists clinics_phone_normalized_idx
  on public.clinics (phone_normalized);

comment on column public.clinics.phone_normalized is
  'Last 10 digits of doctor mobile — used for trial abuse prevention.';
comment on column public.clinics.cashfree_subscription_id is
  'Cashfree subscription_id for UPI Autopay mandate.';
comment on column public.clinics.subscription_expires_at is
  'Paid subscription valid-until timestamp (extended +30 days per charge).';
