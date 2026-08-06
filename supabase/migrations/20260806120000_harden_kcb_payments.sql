create table if not exists public.kcb_payments (
  id uuid primary key default gen_random_uuid(),
  checkout_request_id text unique,
  merchant_request_id text,
  phone_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending',
  result_code text,
  result_desc text,
  mpesa_receipt_number text,
  transaction_date text,
  transaction_id uuid,
  customer_id uuid,
  cashier_id text,
  cashier_name text,
  callback_received boolean not null default false,
  callback_payload jsonb,
  raw_request jsonb,
  raw_response jsonb,
  error_message text,
  attempts integer not null default 0,
  idempotency_key text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kcb_payments_status_created on public.kcb_payments(status, created_at desc);
create index if not exists idx_kcb_payments_transaction on public.kcb_payments(transaction_id);
create unique index if not exists idx_kcb_payments_idempotency on public.kcb_payments(idempotency_key) where idempotency_key is not null;

alter table public.kcb_payments enable row level security;
revoke all on public.kcb_payments from anon, authenticated;
grant select on public.kcb_payments to authenticated;

drop policy if exists select_kcb_payments on public.kcb_payments;
create policy kcb_payments_select_authenticated on public.kcb_payments
  for select to authenticated using (true);
