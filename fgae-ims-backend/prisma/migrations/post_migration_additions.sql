-- ---------------------------------------------------------------------
-- 1. Monthly partitions for volunteer_attendance
--    A DEFAULT partition catches any date that has no monthly partition yet.
--    This creates last month through 24 months ahead; a scheduled job
--    (pg_cron) should create future months later.
-- ---------------------------------------------------------------------
CREATE TABLE "volunteer_attendance_default" PARTITION OF "volunteer_attendance" DEFAULT;

DO $$
DECLARE
  first_day date;
  i int;
BEGIN
  FOR i IN -1..24 LOOP
    first_day := (date_trunc('month', current_date) + make_interval(months => i))::date;
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF "volunteer_attendance" FOR VALUES FROM (%L) TO (%L)',
      'volunteer_attendance_' || to_char(first_day, '"y"YYYY"m"MM'),
      first_day,
      (first_day + interval '1 month')::date
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. CHECK constraints (money must be positive, dates and GPS must make sense)
-- ---------------------------------------------------------------------
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "project_budget_allocations"
  ADD CONSTRAINT "project_budget_allocations_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "allowance_requests"
  ADD CONSTRAINT "allowance_requests_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "allowance_disbursements"
  ADD CONSTRAINT "allowance_disbursements_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_dates_valid" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "volunteer_assignments"
  ADD CONSTRAINT "volunteer_assignments_dates_valid" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "volunteer_attendance"
  ADD CONSTRAINT "volunteer_attendance_gps_valid" CHECK (
    ("latitude"  IS NULL OR "latitude"  BETWEEN  -90 AND  90) AND
    ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "volunteer_attendance_times_valid" CHECK (
    "checkIn" IS NULL OR "checkOut" IS NULL OR "checkOut" >= "checkIn"
  );

-- ---------------------------------------------------------------------
-- 3. Disbursement ledger protection
--    Rows can never be deleted. Only status, providerTxnId, failureReason and
--    completedAt may change, and a PAID or FAILED payout can never change status again.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_disbursement_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'allowance_disbursements is an append-only ledger: it cannot be truncated';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'allowance_disbursements is an append-only ledger: rows cannot be deleted';
  END IF;

  IF NEW."id"                 IS DISTINCT FROM OLD."id"
  OR NEW."allowanceRequestId" IS DISTINCT FROM OLD."allowanceRequestId"
  OR NEW."executedById"       IS DISTINCT FROM OLD."executedById"
  OR NEW."method"             IS DISTINCT FROM OLD."method"
  OR NEW."amount"             IS DISTINCT FROM OLD."amount"
  OR NEW."recipientPhone"     IS DISTINCT FROM OLD."recipientPhone"
  OR NEW."idempotencyKey"     IS DISTINCT FROM OLD."idempotencyKey"
  OR NEW."executedAt"         IS DISTINCT FROM OLD."executedAt" THEN
    RAISE EXCEPTION 'allowance_disbursements: only status, providerTxnId, failureReason and completedAt may change';
  END IF;

  IF OLD."status" IN ('PAID', 'FAILED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'allowance_disbursements: a % payout cannot change status again', OLD."status";
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "allowance_disbursements_protect_rows"
  BEFORE UPDATE OR DELETE ON "allowance_disbursements"
  FOR EACH ROW EXECUTE FUNCTION protect_disbursement_ledger();

CREATE TRIGGER "allowance_disbursements_protect_truncate"
  BEFORE TRUNCATE ON "allowance_disbursements"
  FOR EACH STATEMENT EXECUTE FUNCTION protect_disbursement_ledger();

-- ---------------------------------------------------------------------
-- 4. Row Level Security: ON for every table, with no policies.
--    Supabase exposes the public schema through an automatic API, so a table
--    without RLS can be read or written by anyone holding the public key.
--    With RLS on and no policies, that API sees nothing. The backend connects
--    with the database owner role (Prisma), which is not affected.
--    Tables created by later migrations need this again.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
