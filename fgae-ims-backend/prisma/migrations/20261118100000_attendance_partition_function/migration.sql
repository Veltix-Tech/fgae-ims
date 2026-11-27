-- =====================================================================
-- Attendance partition maintenance
-- Creates monthly partitions of volunteer_attendance, from the current month
-- to N months ahead. Safe to run repeatedly: existing months are skipped.
-- If rows for a missing month already sit in the DEFAULT partition, they are
-- moved into the new partition (PostgreSQL refuses to create the partition
-- otherwise).
-- Each new partition also gets Row Level Security switched on.
-- Returns how many partitions were created.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.create_attendance_partitions(months_ahead integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  i          integer;
  first_day  date;
  next_day   date;
  part_name  text;
  created    integer := 0;
BEGIN
  IF months_ahead IS NULL OR months_ahead < 0 OR months_ahead > 120 THEN
    RAISE EXCEPTION 'months_ahead must be between 0 and 120';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.attendance_rows_to_move
    (LIKE public.volunteer_attendance) ON COMMIT DROP;

  FOR i IN 0..months_ahead LOOP
    first_day := (date_trunc('month', current_date) + make_interval(months => i))::date;
    next_day  := (first_day + interval '1 month')::date;
    part_name := 'volunteer_attendance_' || to_char(first_day, '"y"YYYY"m"MM');

    IF to_regclass(format('public.%I', part_name)) IS NULL THEN
      -- take out any rows already parked in the default partition for this month
      WITH moved AS (
        DELETE FROM public.volunteer_attendance_default
        WHERE "activityDate" >= first_day AND "activityDate" < next_day
        RETURNING *
      )
      INSERT INTO pg_temp.attendance_rows_to_move SELECT * FROM moved;

      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.volunteer_attendance FOR VALUES FROM (%L) TO (%L)',
        part_name, first_day, next_day);

      -- every partition is its own table in the public schema, so it needs RLS too,
      -- otherwise Supabase's API could read it
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', part_name);

      -- put them back; they now land in the new partition
      INSERT INTO public.volunteer_attendance SELECT * FROM pg_temp.attendance_rows_to_move;
      DELETE FROM pg_temp.attendance_rows_to_move;

      created := created + 1;
    END IF;
  END LOOP;

  RETURN created;
END;
$$;

-- Only the database owner and trusted server roles should run this. Supabase
-- exposes public functions through its API, so remove the public grants.
REVOKE ALL ON FUNCTION public.create_attendance_partitions(integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.create_attendance_partitions(integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.create_attendance_partitions(integer) FROM authenticated;
  END IF;
END $$;
