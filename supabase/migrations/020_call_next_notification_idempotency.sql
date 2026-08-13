-- One "called" WhatsApp notification per queue token (race-safe idempotency).
create unique index if not exists notification_logs_called_token_unique
  on public.notification_logs (token_id)
  where token_id is not null and type = 'called';
