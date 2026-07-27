-- BYK RoadRescue — Fix: profiles RLS policy blocked ALL profile reads
-- Run this once in Supabase SQL Editor. Fixes a bug introduced by
-- supabase/technician_migration.sql.
--
-- What went wrong: "dispatcher_admin_can_read_all_profiles" checked the
-- caller's role by querying public.profiles from INSIDE a policy ON
-- public.profiles itself. That self-check confused Postgres's row
-- security evaluation for this table and blocked profile reads entirely
-- for every user — including a dispatcher reading their OWN row — which
-- is why amin@bykroadrescue.com got "Signed in, but not authorized"
-- right after that migration ran, despite having a correct profiles row.
--
-- Fix: look up the caller's role through a small SECURITY DEFINER
-- function instead of a policy-time self-join on profiles. The function
-- runs with the privileges of whoever created it (a narrowly-scoped,
-- read-only role lookup), so there's no self-check inside the policy —
-- this is the standard Supabase/Postgres pattern for role checks in RLS.

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

drop policy if exists "dispatcher_admin_can_read_all_profiles" on public.profiles;
create policy "dispatcher_admin_can_read_all_profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

drop policy if exists "dispatcher_admin_can_read_all_jobs" on public.jobs;
create policy "dispatcher_admin_can_read_all_jobs"
  on public.jobs for select
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'));

drop policy if exists "dispatcher_admin_can_update_all_jobs" on public.jobs;
create policy "dispatcher_admin_can_update_all_jobs"
  on public.jobs for update
  to authenticated
  using (public.current_user_role() in ('dispatcher', 'admin'))
  with check (public.current_user_role() in ('dispatcher', 'admin'));
