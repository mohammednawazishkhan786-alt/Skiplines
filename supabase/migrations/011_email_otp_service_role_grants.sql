-- Ensure service_role has full access to email OTP table (RLS bypassed with service key)

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.email_otp_requests
  to service_role;

grant usage, select
  on all sequences in schema public
  to service_role;
