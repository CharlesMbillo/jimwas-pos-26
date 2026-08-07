create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(), name text not null, report_type text not null,
  frequency text not null, recipients jsonb not null default '[]'::jsonb, filters jsonb not null default '{}'::jsonb,
  next_run_at timestamptz not null, is_active boolean not null default true, created_at timestamptz not null default now(), sync_status text not null default 'pending'
);
create table if not exists public.safe_drops (
  id uuid primary key default gen_random_uuid(), shift_id uuid not null, amount numeric(12,2) not null check (amount > 0),
  reason text not null, approved_by uuid, created_at timestamptz not null default now(), sync_status text not null default 'pending'
);
create index if not exists idx_report_schedules_active on public.report_schedules(is_active);
create index if not exists idx_report_schedules_next_run on public.report_schedules(next_run_at);
create index if not exists idx_safe_drops_shift on public.safe_drops(shift_id);
alter table public.report_schedules enable row level security;
alter table public.safe_drops enable row level security;
