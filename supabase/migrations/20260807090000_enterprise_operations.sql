create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(), cashier_id uuid, branch_id text, terminal_id text,
  opened_at timestamptz not null, closed_at timestamptz, opening_float numeric(12,2) not null default 0,
  cash_count numeric(12,2), cash_sales numeric(12,2) not null default 0, card_sales numeric(12,2) not null default 0,
  mobile_money_sales numeric(12,2) not null default 0, bank_sales numeric(12,2) not null default 0,
  credit_sales numeric(12,2) not null default 0, refunds numeric(12,2) not null default 0,
  discounts numeric(12,2) not null default 0, tax numeric(12,2) not null default 0,
  gross_sales numeric(12,2) not null default 0, net_sales numeric(12,2) not null default 0,
  variance numeric(12,2), status text not null default 'open' check (status in ('open','closed','archived')),
  x_report_at timestamptz, y_report_at timestamptz, z_report_at timestamptz,
  sync_status text not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reconciliations (
  id uuid primary key default gen_random_uuid(), payment_method text not null, reference text, transaction_id uuid,
  customer_id uuid, expected_amount numeric(12,2) not null default 0, received_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('matched','pending','partial','failed','duplicate','exception','reversed')),
  matched_at timestamptz, notes text, created_at timestamptz not null default now(), sync_status text not null default 'pending'
);
create table if not exists public.outbound_deliveries (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null, customer_id uuid,
  status text not null default 'pending' check (status in ('pending','packed','assigned','dispatched','in_transit','delivered','closed','returned')),
  address text, courier text, driver text, vehicle text, eta timestamptz, cod_amount numeric(12,2),
  cod_status text check (cod_status in ('pending','collected','failed','not_applicable')),
  proof_type text check (proof_type in ('signature','photo','otp','qr')), proof_reference text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), sync_status text not null default 'pending'
);
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(), name text not null, type text not null,
  value numeric(12,2) not null default 0, priority integer not null default 0, starts_at timestamptz, ends_at timestamptz,
  product_ids jsonb not null default '[]'::jsonb, customer_group text, stackable boolean not null default false,
  is_active boolean not null default true, sync_status text not null default 'pending'
);
create table if not exists public.supplier_fulfillments (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null, supplier_id uuid not null,
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  supplier_reference text, margin numeric(12,2), created_at timestamptz not null default now(), sync_status text not null default 'pending'
);
create index if not exists idx_shifts_status on public.shifts(status);
create index if not exists idx_reconciliations_status on public.reconciliations(status);
create index if not exists idx_outbound_deliveries_status on public.outbound_deliveries(status);
create index if not exists idx_outbound_deliveries_transaction on public.outbound_deliveries(transaction_id);
create index if not exists idx_offers_active on public.offers(is_active);
create index if not exists idx_supplier_fulfillments_transaction on public.supplier_fulfillments(transaction_id);
alter table public.shifts enable row level security;
alter table public.reconciliations enable row level security;
alter table public.outbound_deliveries enable row level security;
alter table public.offers enable row level security;
alter table public.supplier_fulfillments enable row level security;
