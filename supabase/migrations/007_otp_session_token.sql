-- Session token for verified WhatsApp OTP

alter table public.phone_otp_requests
  add column if not exists session_token text;

create index if not exists phone_otp_requests_session_token_idx
  on public.phone_otp_requests (session_token)
  where session_token is not null;
