-- BYK RoadRescue — Auth migration
-- Run this once in Supabase SQL Editor, AFTER supabase/schema.sql.
--
-- What this changes:
-- 1. Adds `profiles` — one row per internal staff account (dispatcher/technician/admin),
--    linked 1:1 to Supabase's built-in `auth.users`. Customers never get a profile row
--    and never log in — the "help in under 3 taps" flow in app/request/page.tsx stays
--    fully anonymous, on purpose.
-- 2. Replaces the TEMP wide-open policies from schema.sql with real ones:
--    - anyone (anon or logged-in) can still INSERT a job — that's the public request form
--    - only a logged-in user WITH a profiles row can SELECT or UPDATE jobs — this is the
--      actual fix for the "anyone can read every customer's phone number" gap.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('dispatcher', 'technician', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users_can_read_own_profile" on public.profiles;
create policy "users_can_read_own_profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Drop the temporary wide-open policies from schema.sql -----------------
drop policy if exists "anon_can_read_jobs_TEMP" on public.jobs;
drop policy if exists "anon_can_update_jobs_TEMP" on public.jobs;
-- "anon_can_insert_jobs" is INTENTIONALLY kept — see note above.

-- Real policies -----------------------------------------------------------
drop policy if exists "staff_can_read_jobs" on public.jobs;
create policy "staff_can_read_jobs"
  on public.jobs for select
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid()));

drop policy if exists "staff_can_update_jobs" on public.jobs;
create policy "staff_can_update_jobs"
  on public.jobs for update
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid()))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid()));

-- ---------------------------------------------------------------------
-- ONE-TIME SETUP — create your first dispatcher account:
-- 1. Supabase Dashboard → Authentication → Users → "Add user" → enter an
--    email + password for yourself. Copy the User UID it generates.
-- 2. Come back here and run (replace the UID and name):
--
--   insert into public.profiles (id, full_name, role)
--   values ('PASTE-USER-UID-HERE', 'Your Name', 'dispatcher');
--
-- Without this insert, you can log in but /dispatch will still show
-- "permission denied" — the profiles row is what actually grants access,
-- not just having a login.
