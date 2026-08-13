-- 021: Permanent one-time trial entitlement per Doctor (clinics.id = doctor account).
-- Additive only — preserves existing UUIDs, subscriptions, payments, and queue data.

alter table public.clinics
  add column if not exists trial_used boolean not null default false;

comment on column public.clinics.trial_used is
  'True once this Doctor has claimed the one-time 7-day trial. Never reset on logout, renewal, or expiry.';

-- Every existing production doctor account has already consumed its trial slot.
update public.clinics
set trial_used = true
where trial_used = false;

-- One verified mobile number cannot claim a second trial account.
create unique index if not exists clinics_phone_normalized_unique_idx
  on public.clinics (phone_normalized)
  where phone_normalized is not null and phone_normalized <> '';

comment on index public.clinics_phone_normalized_unique_idx is
  'Prevents duplicate doctor registrations per normalized mobile (one trial per phone).';

comment on column public.clinics.id is
  'Permanent Skiplines Doctor ID (doctor_id). Assigned once at registration. Queue rows reference this as clinic_id. Never changes.';
