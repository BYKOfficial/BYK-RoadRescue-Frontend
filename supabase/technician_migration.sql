-- BYK RoadRescue — Technician access migration
-- Run this once in Supabase SQL Editor, AFTER supabase/auth_migration.sql.
--
-- What this changes:
-- 1. Adds `technician_id` to `jobs` — a REAL link to a technician's
--    public.profiles row (role = 'technician'), replacing the old
--    free-text-only `technician_name` demo/placeholder used by the
--    "Assign" button in app/dispatch/page.tsx. `technician_name` stays
--    as a column (nothing that already reads it breaks) and will be set
--    alongside `technician_id` going forward, for display convenience.
-- 2. Splits the old "any logged-in staff sees everything" policy in two:
--      - dispatcher/admin: can still read + update ALL jobs (unchanged
--        behaviour from their point of view)
--      - technician: can ONLY read jobs assigned to them (no update yet —
--        that's a later, separate step, once/if technicians need to
--        change their own job's status)
--    Without this split, the moment a technician account exists, that
--    technician could open /dispatch and see every customer's name,
--    phone number, and exact location — this closes that gap.
-- 3. Lets dispatcher/admin read the full technician list from `profiles`,
--    so the "Assign" dropdown in /dispatch can show real technicians
--    instead of the old hardcoded demo name. (profiles currently only
--    lets a user read their OWN row — not enough to populate a picker.)

-- 1. New column on jobs -----------------------------------------------

alter table public.jobs
  add column if not exists technician_id uuid references public.profiles(id) on delete set null;

create index if not exists jobs_technician_id_idx on public.jobs (technician_id);

-- 2. Replace the old blanket "any staff" policies on jobs ---------------

drop policy if exists "staff_can_read_jobs" on public.jobs;
create policy "dispatcher_admin_can_read_all_jobs"
  on public.jobs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('dispatcher', 'admin')
    )
  );

drop policy if exists "staff_can_update_jobs" on public.jobs;
create policy "dispatcher_admin_can_update_all_jobs"
  on public.jobs for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('dispatcher', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('dispatcher', 'admin')
    )
  );

drop policy if exists "technician_can_read_own_jobs" on public.jobs;
create policy "technician_can_read_own_jobs"
  on public.jobs for select
  to authenticated
  using (technician_id = auth.uid());

-- 3. Dispatcher/admin need to see the technician list to assign jobs -----

drop policy if exists "dispatcher_admin_can_read_all_profiles" on public.profiles;
create policy "dispatcher_admin_can_read_all_profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('dispatcher', 'admin')
    )
  );

-- ---------------------------------------------------------------------
-- Nothing to insert here — you already have real accounts. If you just
-- created a technician account for the first time (Supabase Dashboard →
-- Authentication → Users → Add user → copy UID), make sure you've also
-- run:
--
--   insert into public.profiles (id, full_name, role)
--   values ('PASTE-USER-UID-HERE', 'Technician Name', 'technician');
--
-- Without that profiles row, this migration's policies have nothing to
-- match against for that account — same rule as the dispatcher setup.
