-- =====================================================================

-- helper: run a statement and compare the outcome with what we expect.
--   expected = 'ok'        -> the statement must succeed
--   expected = '<SQLSTATE>' -> it must fail with that error code
--     23505 unique_violation, 23514 check_violation,
--     23503 foreign_key_violation, P0001 raised by our own trigger
CREATE OR REPLACE FUNCTION pg_temp.expect(label text, stmt text, expected text)
RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF expected = SQLSTATE THEN
      RETURN 'PASS  ' || label;
    END IF;
    RETURN 'FAIL  ' || label || '  (expected ' || expected || ', got ' || SQLSTATE || ': ' || SQLERRM || ')';
  END;
  IF expected = 'ok' THEN
    RETURN 'PASS  ' || label;
  END IF;
  RETURN 'FAIL  ' || label || '  (expected error ' || expected || ' but the statement succeeded)';
END $f$;

-- helper: a public-API role must not be able to read table data.
CREATE OR REPLACE FUNCTION pg_temp.rls_blocks(role_name text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    EXECUTE 'SELECT count(*) FROM persons' INTO n;
    EXECUTE 'RESET ROLE';
    IF n = 0 THEN
      RETURN 'PASS  RLS: role ' || role_name || ' sees 0 rows in persons';
    END IF;
    RETURN 'FAIL  RLS: role ' || role_name || ' can read ' || n || ' rows in persons';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RETURN 'PASS  RLS: role ' || role_name || ' has no access to persons';
    WHEN undefined_object OR invalid_parameter_value THEN
      RETURN 'SKIP  RLS: role ' || role_name || ' does not exist in this database';
  END;
END $f$;

DO $test$
DECLARE
  results text[] := ARRAY[]::text[];
  r text;
  n bigint;
  pname text;
  passes int := 0;
  fails int := 0;
  skips int := 0;

  org uuid := gen_random_uuid();
  area uuid := gen_random_uuid();
  branch uuid := gen_random_uuid();
  dept uuid := gen_random_uuid();
  prog uuid := gen_random_uuid();
  proj uuid := gen_random_uuid();
  budget uuid := gen_random_uuid();
  p_vol uuid := gen_random_uuid();
  p_other uuid := gen_random_uuid();
  u_sup uuid := gen_random_uuid();
  u_req uuid := gen_random_uuid();
  role_a uuid;
  role_b uuid;
  app uuid := gen_random_uuid();
  vol uuid := gen_random_uuid();
  asg uuid := gen_random_uuid();
  areq uuid := gen_random_uuid();
  disb uuid := gen_random_uuid();
BEGIN
  -- ------------------------------------------------------------------
  -- Test data (created inside this transaction only)
  -- ------------------------------------------------------------------
  INSERT INTO organizations (id, code, name, "updatedAt") VALUES (org, 'ZZ-TEST-ORG', 'ZZ Test Organization', now());
  INSERT INTO areas (id, "organizationId", code, name, "updatedAt") VALUES (area, org, 'ZZ-AREA', 'ZZ Test Area', now());
  INSERT INTO branches (id, "areaId", code, name, "updatedAt") VALUES (branch, area, 'ZZ-BR', 'ZZ Test Branch', now());
  INSERT INTO departments (id, code, name, "updatedAt") VALUES (dept, 'ZZ-DEP', 'ZZ Test Department', now());
  INSERT INTO programs (id, name, "updatedAt") VALUES (prog, 'ZZ Test Program', now());
  INSERT INTO projects (id, "programId", "areaId", name, "startDate", "updatedAt") VALUES (proj, prog, area, 'ZZ Test Project', '2026-01-01', now());
  INSERT INTO project_budget_allocations (id, "projectId", "budgetCode", amount, "updatedAt") VALUES (budget, proj, 'ZZ-BUDGET', 1000, now());

  INSERT INTO persons (id, "firstName", "lastName", gender, email, phone, "dateOfBirth", "updatedAt")
    VALUES (p_vol, 'Tigist', 'Assefa', 'FEMALE', 'zz-tigist@example.test', '+251900000001', '1998-05-05', now());
  INSERT INTO persons (id, "firstName", "lastName", gender, email, phone, "dateOfBirth", "updatedAt")
    VALUES (p_other, 'Abebe', 'Kebede', 'MALE', 'zz-abebe@example.test', '+251900000002', '1995-03-03', now());

  INSERT INTO users (id, email, "firstName", "lastName", "updatedAt") VALUES (u_sup, 'zz-sup@example.test', 'Sara', 'Supervisor', now());
  INSERT INTO users (id, email, "firstName", "lastName", "updatedAt") VALUES (u_req, 'zz-req@example.test', 'Paul', 'Manager', now());

  INSERT INTO roles (id, code, name, "updatedAt") VALUES (gen_random_uuid(), 'FIELD_SUPERVISOR', 'FIELD SUPERVISOR', now()) ON CONFLICT (code) DO NOTHING;
  INSERT INTO roles (id, code, name, "updatedAt") VALUES (gen_random_uuid(), 'VOLUNTEER', 'VOLUNTEER', now()) ON CONFLICT (code) DO NOTHING;
  SELECT id INTO role_a FROM roles WHERE code = 'FIELD_SUPERVISOR';
  SELECT id INTO role_b FROM roles WHERE code = 'VOLUNTEER';

  INSERT INTO volunteer_applications (id, "personId", "submissionChannel", "departmentId", "preferredBranchId", "updatedAt")
    VALUES (app, p_vol, 'PUBLIC', dept, branch, now());
  INSERT INTO volunteers (id, "personId", "applicationId", "departmentId", "volunteerNumber", "updatedAt")
    VALUES (vol, p_vol, app, dept, 'ZZ-VOL-0001', now());
  INSERT INTO volunteer_assignments (id, "volunteerId", "projectId", "branchId", "supervisorId", "startDate", "updatedAt")
    VALUES (asg, vol, proj, branch, u_sup, '2026-11-01', now());
  INSERT INTO allowance_requests (id, "volunteerId", "projectId", "budgetAllocationId", "requestedById", amount, "updatedAt")
    VALUES (areq, vol, proj, budget, u_req, 500, now());
  INSERT INTO allowance_disbursements (id, "allowanceRequestId", method, amount, "recipientPhone", "idempotencyKey")
    VALUES (disb, areq, 'TELEBIRR_BULK', 500, '+251911223344', 'zz-idem-1');

  -- ------------------------------------------------------------------
  -- 1. Attendance partitions
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('attendance: insert a row for today', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId") VALUES (gen_random_uuid(), current_date, %L)', asg), 'ok');
  SELECT tableoid::regclass::text INTO pname FROM volunteer_attendance WHERE "assignmentId" = asg AND "activityDate" = current_date;
  IF pname LIKE 'volunteer_attendance\_y%' THEN
    results := results || ('PASS  attendance: today lands in a monthly partition (' || pname || ')');
  ELSE
    results := results || ('FAIL  attendance: today landed in ' || coalesce(pname, 'nothing') || ' (create next months'' partitions!)');
  END IF;

  results := results || pg_temp.expect('attendance: a far-future date is accepted', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId") VALUES (gen_random_uuid(), %L, %L)', '2040-01-15', asg), 'ok');
  SELECT tableoid::regclass::text INTO pname FROM volunteer_attendance WHERE "activityDate" = '2040-01-15';
  IF pname = 'volunteer_attendance_default' THEN
    results := results || 'PASS  attendance: a date with no monthly partition goes to the default partition'::text;
  ELSE
    results := results || ('FAIL  attendance: 2040 row landed in ' || coalesce(pname, 'nothing'));
  END IF;

  results := results || pg_temp.expect('attendance: same assignment twice on one day is rejected', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId") VALUES (gen_random_uuid(), current_date, %L)', asg), '23505');
  results := results || pg_temp.expect('attendance: latitude outside -90..90 is rejected', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId", latitude) VALUES (gen_random_uuid(), current_date + 2, %L, 123.4)', asg), '23514');
  results := results || pg_temp.expect('attendance: longitude outside -180..180 is rejected', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId", longitude) VALUES (gen_random_uuid(), current_date + 3, %L, 200)', asg), '23514');
  results := results || pg_temp.expect('attendance: check-out before check-in is rejected', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId", "checkIn", "checkOut") VALUES (gen_random_uuid(), current_date + 4, %L, %L, %L)', asg, '16:00', '08:00'), '23514');
  results := results || pg_temp.expect('attendance: a valid GPS point is accepted', format(
    'INSERT INTO volunteer_attendance (id, "activityDate", "assignmentId", latitude, longitude) VALUES (gen_random_uuid(), current_date + 5, %L, 9.0054, 38.7636)', asg), 'ok');

  -- ------------------------------------------------------------------
  -- 2. Money and dates must make sense
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('allowance request: amount 0 is rejected', format(
    'INSERT INTO allowance_requests (id, "volunteerId", "projectId", "budgetAllocationId", "requestedById", amount, "updatedAt") VALUES (gen_random_uuid(), %L, %L, %L, %L, 0, now())', vol, proj, budget, u_req), '23514');
  results := results || pg_temp.expect('budget line: negative amount is rejected', format(
    'INSERT INTO project_budget_allocations (id, "projectId", "budgetCode", amount, "updatedAt") VALUES (gen_random_uuid(), %L, %L, -5, now())', proj, 'ZZ-NEG'), '23514');
  results := results || pg_temp.expect('payment: amount 0 is rejected', format(
    'INSERT INTO payments (id, "applicationId", amount, "paymentReference") VALUES (gen_random_uuid(), %L, 0, %L)', app, 'ZZ-PAY-ZERO'), '23514');
  results := results || pg_temp.expect('disbursement: amount 0 is rejected', format(
    'INSERT INTO allowance_disbursements (id, "allowanceRequestId", method, amount, "recipientPhone", "idempotencyKey") VALUES (gen_random_uuid(), %L, %L, 0, %L, %L)', areq, 'TELEBIRR_BULK', '+251911223344', 'zz-idem-zero'), '23514');
  results := results || pg_temp.expect('project: end date before start date is rejected', format(
    'INSERT INTO projects (id, "programId", "areaId", name, "startDate", "endDate", "updatedAt") VALUES (gen_random_uuid(), %L, %L, %L, %L, %L, now())', prog, area, 'ZZ Bad Dates', '2026-12-01', '2026-11-01'), '23514');
  results := results || pg_temp.expect('assignment: end date before start date is rejected', format(
    'INSERT INTO volunteer_assignments (id, "volunteerId", "projectId", "branchId", "supervisorId", "startDate", "endDate", "updatedAt") VALUES (gen_random_uuid(), %L, %L, %L, %L, %L, %L, now())', vol, proj, branch, u_sup, '2026-12-01', '2026-11-01'), '23514');

  -- ------------------------------------------------------------------
  -- 3. Duplicates (idempotency and identity)
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('payout: reusing an idempotency key is rejected', format(
    'INSERT INTO allowance_disbursements (id, "allowanceRequestId", method, amount, "recipientPhone", "idempotencyKey") VALUES (gen_random_uuid(), %L, %L, 500, %L, %L)', areq, 'TELEBIRR_BULK', '+251911223344', 'zz-idem-1'), '23505');
  results := results || pg_temp.expect('payment: first payment reference is accepted', format(
    'INSERT INTO payments (id, "applicationId", amount, "paymentReference") VALUES (gen_random_uuid(), %L, 150, %L)', app, 'ZZ-PAY-1'), 'ok');
  results := results || pg_temp.expect('payment: reusing a payment reference is rejected', format(
    'INSERT INTO payments (id, "applicationId", amount, "paymentReference") VALUES (gen_random_uuid(), %L, 150, %L)', app, 'ZZ-PAY-1'), '23505');
  results := results || pg_temp.expect('person: reusing a phone number is rejected', format(
    'INSERT INTO persons (id, "firstName", "lastName", gender, email, phone, "dateOfBirth", "updatedAt") VALUES (gen_random_uuid(), %L, %L, %L, %L, %L, %L, now())', 'Dup', 'Phone', 'MALE', 'zz-dup@example.test', '+251900000001', '2000-01-01'), '23505');

  -- ------------------------------------------------------------------
  -- 4. Payout ledger protection
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('ledger: a webhook can set status, provider id and completion time', format(
    'UPDATE allowance_disbursements SET status = %L, "providerTxnId" = %L, "completedAt" = now() WHERE id = %L', 'PAID', 'TB-ZZ-1', disb), 'ok');
  results := results || pg_temp.expect('ledger: changing the amount is blocked', format(
    'UPDATE allowance_disbursements SET amount = 9999 WHERE id = %L', disb), 'P0001');
  results := results || pg_temp.expect('ledger: changing the recipient is blocked', format(
    'UPDATE allowance_disbursements SET "recipientPhone" = %L WHERE id = %L', '+251922000000', disb), 'P0001');
  results := results || pg_temp.expect('ledger: changing the idempotency key is blocked', format(
    'UPDATE allowance_disbursements SET "idempotencyKey" = %L WHERE id = %L', 'zz-new-key', disb), 'P0001');
  results := results || pg_temp.expect('ledger: a PAID payout cannot change status again', format(
    'UPDATE allowance_disbursements SET status = %L WHERE id = %L', 'FAILED', disb), 'P0001');
  results := results || pg_temp.expect('ledger: deleting a payout is blocked', format(
    'DELETE FROM allowance_disbursements WHERE id = %L', disb), 'P0001');
  results := results || pg_temp.expect('ledger: truncating the table is blocked',
    'TRUNCATE allowance_disbursements', 'P0001');

  -- ------------------------------------------------------------------
  -- 5. Roles: one active role per user (leader's rule)
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('roles: a user can be given a first role', format(
    'INSERT INTO user_roles (id, "userId", "roleId") VALUES (gen_random_uuid(), %L, %L)', u_sup, role_a), 'ok');
  results := results || pg_temp.expect('roles: a second ACTIVE role for the same user is rejected', format(
    'INSERT INTO user_roles (id, "userId", "roleId") VALUES (gen_random_uuid(), %L, %L)', u_sup, role_b), '23505');
  results := results || pg_temp.expect('roles: the first role can be revoked', format(
    'UPDATE user_roles SET "revokedAt" = now() WHERE "userId" = %L', u_sup), 'ok');
  results := results || pg_temp.expect('roles: after revoking, a new role is accepted', format(
    'INSERT INTO user_roles (id, "userId", "roleId") VALUES (gen_random_uuid(), %L, %L)', u_sup, role_b), 'ok');

  -- ------------------------------------------------------------------
  -- 6. History cannot be deleted from under records that depend on it
  -- ------------------------------------------------------------------
  results := results || pg_temp.expect('project with budget lines cannot be deleted', format(
    'DELETE FROM projects WHERE id = %L', proj), '23503');
  results := results || pg_temp.expect('allowance request with a payout cannot be deleted', format(
    'DELETE FROM allowance_requests WHERE id = %L', areq), '23503');
  results := results || pg_temp.expect('person who is a volunteer cannot be deleted', format(
    'DELETE FROM persons WHERE id = %L', p_vol), '23503');
  results := results || pg_temp.expect('branch with an assignment cannot be deleted', format(
    'DELETE FROM branches WHERE id = %L', branch), '23503');

  -- ------------------------------------------------------------------
  -- 7. Row Level Security
  -- ------------------------------------------------------------------
  SELECT count(*) INTO n FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
  IF n = 0 THEN
    results := results || 'PASS  RLS: every table in the public schema has it enabled'::text;
  ELSE
    results := results || ('FAIL  RLS: ' || n || ' table(s) in public have RLS off: ' ||
      (SELECT string_agg(tablename, ', ') FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity));
  END IF;
  results := results || pg_temp.rls_blocks('anon');
  results := results || pg_temp.rls_blocks('authenticated');
  SELECT count(*) INTO n FROM persons;
  IF n >= 2 THEN
    results := results || 'PASS  RLS: the backend connection (table owner) can still read its own data'::text;
  ELSE
    results := results || ('FAIL  RLS: the backend connection sees only ' || n || ' persons');
  END IF;

  -- ------------------------------------------------------------------
  -- Report (raising an exception also rolls back every test row)
  -- ------------------------------------------------------------------
  FOREACH r IN ARRAY results LOOP
    IF r LIKE 'PASS%' THEN passes := passes + 1;
    ELSIF r LIKE 'SKIP%' THEN skips := skips + 1;
    ELSE fails := fails + 1; END IF;
  END LOOP;

  IF fails = 0 THEN
    RAISE EXCEPTION E'\n=== ALL % TESTS PASSED (% skipped) ===\n%\n\nNothing was saved: this run always rolls back.',
      passes, skips, array_to_string(results, E'\n');
  ELSE
    RAISE EXCEPTION E'\n=== % TEST(S) FAILED, % passed, % skipped ===\n%\n\nNothing was saved: this run always rolls back.',
      fails, passes, skips, array_to_string(results, E'\n');
  END IF;
END
$test$;
