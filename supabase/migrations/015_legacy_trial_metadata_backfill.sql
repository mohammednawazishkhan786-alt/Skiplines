-- Safe legacy metadata backfill only.
-- Does NOT change subscription_status, trial_ends_at, or subscription_expires_at.
-- Does NOT grant or remove paid access.

update public.clinics
set
  trial_started_at = trial_ends_at - interval '7 days',
  updated_at = now()
where trial_started_at is null
  and trial_ends_at is not null
  and lower(subscription_status) in ('trial', 'trialing');
