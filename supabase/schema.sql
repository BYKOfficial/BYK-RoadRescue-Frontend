-- BYK RoadRescue — initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Scope note: this is the MVP "prove real-time works" table — a single `jobs`
-- table, no separate technicians/auth yet (see 01-ARCHITECTURE.md Phase 1/2/3).
-- It intentionally mirrors the JobStatus / ServiceCategory / VehicleType
-- vocabulary already defined in packages/shared-types/api-contracts.ts so the
-- two stay in sync as the schema grows.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  customer_name text not null,
  customer_phone text not null,
  vehicle_type text not null check (vehicle_type in ('car', 'bike', 'ev', 'commercial')),
  service_category text not null check (
    service_category in (
      'towing', 'jumpstart', 'puncture', 'fuel_delivery', 'lockout',
      'minor_repair', 'accident_emergency'
    )
  ),
  priority text not null default 'standard' check (priority in ('emergency', 'standard', 'fleet_contract')),
  status text not null default 'requested' check (
    status in (
      'requested', 'matched', 'en_route', 'arrived', 'in_progress',
      'completed', 'cancelled'
    )
  ),

  lat double precision not null,
  lng double precision not null,
  notes text,

  technician_name text,
  sla_deadline timestamptz not null
);

-- Keep updated_at current on every write, so the dispatch UI can show
-- "last updated Nm ago" later without a separate audit table yet.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Row Level Security ---------------------------------------------------
-- Your project has "automatic RLS" on, so this table starts fully locked.
-- The policies below intentionally allow public (anon) read/write so the
-- demo request form and dispatch board work with NO login system yet.
--
-- >>> IMPORTANT BEFORE REAL CUSTOMERS USE THIS <<<
-- customer_phone is personal data. Once technician/dispatcher accounts
-- exist (Supabase Auth), replace the "select" and "update" policies below
-- so only authenticated dispatcher/technician roles can read or update —
-- anonymous customers should only ever be able to INSERT their own job,
-- never read the whole table. Tracked as a Phase-2 item, not done here.

alter table public.jobs enable row level security;

drop policy if exists "anon_can_insert_jobs" on public.jobs;
create policy "anon_can_insert_jobs"
  on public.jobs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon_can_read_jobs_TEMP" on public.jobs;
create policy "anon_can_read_jobs_TEMP"
  on public.jobs for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_can_update_jobs_TEMP" on public.jobs;
create policy "anon_can_update_jobs_TEMP"
  on public.jobs for update
  to anon, authenticated
  using (true)
  with check (true);

-- Realtime ---------------------------------------------------------------
-- Without this, INSERT/UPDATE events never reach the browser and the
-- dispatch board would only ever show what it saw on first page load.
alter publication supabase_realtime add table public.jobs;
