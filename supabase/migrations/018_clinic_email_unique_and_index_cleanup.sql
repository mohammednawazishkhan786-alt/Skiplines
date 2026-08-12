-- 018: Enforce unique normalized clinic email.
-- Pre-check (2026-08-12): zero duplicate lower(trim(email)) rows in production.

CREATE UNIQUE INDEX IF NOT EXISTS clinics_email_unique_idx
  ON public.clinics (lower(trim(email)));

COMMENT ON INDEX public.clinics_email_unique_idx IS
  'Prevents duplicate clinic registrations per normalized email address.';
