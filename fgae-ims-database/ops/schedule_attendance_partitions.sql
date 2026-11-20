-- 1. Enable the scheduler (Dashboard alternative: Database > Extensions > pg_cron)
create extension if not exists pg_cron;

-- 2. Every day at 03:00 UTC, make sure the next 24 months have partitions.
--    The function skips months that already exist, so a daily run is harmless
--    and repairs itself if a run is ever missed. Using the same job name again
--    updates the schedule instead of creating a second job.
select cron.schedule(
  'attendance-partitions',
  '0 3 * * *',
  $$select public.create_attendance_partitions(24)$$
);

-- 3. pg_cron keeps a history row for every run and never deletes them.
--    Once a week, remove history older than 30 days.
select cron.schedule(
  'cron-history-cleanup',
  '30 3 * * 6',
  $$delete from cron.job_run_details where end_time < now() - interval '30 days'$$
);

-- 4. Run the function once now, so you do not have to wait until 03:00.
select public.create_attendance_partitions(24) as partitions_created;

-- 5. Check that both jobs exist and are active.
select jobid, jobname, schedule, command, active
from cron.job
where jobname in ('attendance-partitions', 'cron-history-cleanup');

-- 6. Look at the history after the first scheduled run (the next day).
-- select status, return_message, start_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'attendance-partitions')
-- order by start_time desc limit 5;
