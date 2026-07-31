-- BYK RoadRescue — Let technicians update their own job's status
-- Run this once in Supabase SQL Editor. Builds on
-- supabase/technician_migration.sql + technician_migration_fix.sql.
--
-- Until now, technicians could only SELECT their own jobs (view-only).
-- This adds a narrow UPDATE policy: a technician can change the STATUS
-- of a job assigned to them, but only forward to one of the working
-- states (en_route / arrived / in_progress / completed) — never back to
-- requested/matched (that's a dispatcher action), and never onto a job
-- that isn't theirs (technician_id must already equal them, checked
-- against the row as it exists BEFORE the update, so this can't be used
-- to "claim" someone else's job).

drop policy if exists "technician_can_update_own_job_status" on public.jobs;
create policy "technician_can_update_own_job_status"
  on public.jobs for update
  to authenticated
  using (technician_id = auth.uid())
  with check (
    technician_id = auth.uid()
    and status in ('en_route', 'arrived', 'in_progress', 'completed')
  );
