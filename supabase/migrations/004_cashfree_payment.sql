-- Cashfree payment migration (replaces Razorpay subscription tracking)

alter table public.clinics
  add column if not exists cashfree_order_id text;

comment on column public.clinics.cashfree_order_id is
  'Latest successful Cashfree order ID for Skiplines subscription billing.';
