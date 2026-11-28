# FGAE-IMS data dictionary

Last updated: November 21, 2026. Schema state: migrations up to `20261118100000_attendance_partition_function`.

This is the handoff document for the database. It explains **what each table is for, which rules the database enforces on its own, and what it does not enforce**. The column-by-column reference is generated from the schema in [data-dictionary-columns.md](data-dictionary-columns.md), so it cannot drift from the real database.

Marks used below:
- **◇ inferred**: the purpose was worked out from the schema and not confirmed with the person who wrote the table. Confirm before relying on it.

## 1. What the database is

- PostgreSQL on Supabase, accessed by the backend through Prisma 5.19.
- **36 tables, 21 enums.** The schema is `fgae-ims-backend/prisma/schema.prisma`; changes go through migrations in `fgae-ims-backend/prisma/migrations/`.
- Some rules cannot be written in Prisma, so they live as hand-written SQL inside migrations (section 4).

### Conventions

| Topic | Convention |
|---|---|
| Table names | snake_case, plural (`volunteer_assignments`). Column names are camelCase and need quotes in SQL (`"userId"`). |
| Ids | UUIDs. **The backend generates them, not the database.** A raw SQL insert must supply `id` (use `gen_random_uuid()`) and `"updatedAt"` (use `now()`). |
| Times | `TIMESTAMPTZ` for events, `DATE` for calendar dates (start dates, attendance date), `TIME` for check-in and check-out. |
| Money | `DECIMAL(12,2)`, currency ETB. Never a float. |
| Status values | PostgreSQL enums (a typo cannot be stored). |
| Deleting | Most foreign keys are `RESTRICT`: a row cannot be deleted while other rows point to it, so history stays. `CASCADE` is used only for dependent detail rows (sessions, tokens, credentials, application documents, skills and interests, role permissions, notifications). |
| Access | Row Level Security is on for every table with no policies, so Supabase's public API sees nothing. Only the backend (the database owner) reads and writes. |

## 2. What each table is for

### Organization structure
| Table | Purpose |
|---|---|
| `organizations` | The association itself, the top of the hierarchy. |
| `areas` | Regional offices under the organization. |
| `branches` | Local offices under an area. |
| `health_facilities` | Clinics or project sites under a branch where volunteers can be deployed. |

### Accounts, roles and access
| Table | Purpose |
|---|---|
| `users` | Everyone who can sign in: name, email, phone, status. Optionally linked to a `persons` row. |
| `user_credentials` | Password hashes, kept apart from the profile. |
| `user_sessions` | One row per signed-in device: hashed refresh token, expiry, revoked time. |
| `account_activation_tokens` | One-time hashed tokens for activating an account, resetting a password and verifying an email. |
| `roles` | The nine fixed roles (SUPER_ADMIN to VOLUNTEER), created by the seed script. |
| `permissions` | Individual actions (key, module, label), created by the seed script. |
| `role_permissions` | Which permissions each role holds. |
| `user_roles` | Role history: who held which role, when it was granted, by whom, and when it was revoked. |
| `organizational_assignments` | Where a user may work: organization, area or branch scope, with revoke history. |

### People, applications and volunteers
| Table | Purpose |
|---|---|
| `persons` | A real human (name, phone, email, gender, birth date), stored once. |
| `departments` ◇ | Internal departments that applications and volunteers are placed in. |
| `volunteer_applications` | One application per person: channel, status, preferred branch, department, availability (JSON), who submitted it. |
| `application_documents` | Files attached to an application (ID card). The file itself lives in storage. |
| `payments` | Registration-fee payments collected through Telebirr, per application (money in). |
| `volunteers` | The registered volunteer profile created from an application, with the volunteer number. |
| `volunteer_number_counters` ◇ | The last volunteer number issued per year, so numbers like VOL-2026-0007 never repeat. |
| `notifications` ◇ | Messages to a person (payment, registration, account invitation) and whether they were sent. |
| `skills`, `interests` ◇ | Catalogs of selectable skills and interests. |
| `application_skills`, `application_interests` ◇ | What an applicant selected. |
| `volunteer_skills`, `volunteer_interests` ◇ | The skills and interests of a registered volunteer. |
| `system_settings` ◇ | Key-value configuration, with who last changed each value. |

### Programs, projects and budgets
| Table | Purpose |
|---|---|
| `programs` | Groups of related projects. |
| `projects` | Funded projects run in an area. |
| `project_budget_allocations` | Approved budget lines per project: the pot that allowances draw from. |

### Field operations
| Table | Purpose |
|---|---|
| `volunteer_assignments` | A deployment: a volunteer on a project at a branch (and optionally a facility), under a supervisor, with dates. |
| `volunteer_attendance` | Daily check-in and check-out with GPS and supervisor verification. High volume, so partitioned by month. |

### Allowances and payouts
| Table | Purpose |
|---|---|
| `allowance_requests` | A request to pay a volunteer a per-diem. Moves through DRAFT, SUBMITTED, VERIFIED, APPROVED, PROCESSING, then PAID or FAILED. No money has moved yet. |
| `allowance_disbursements` | The actual payout. A protected ledger. |

### Audit
| Table | Purpose |
|---|---|
| `audit_logs` | Who did what: actor, action, entity, metadata, IP address. Not yet protected or partitioned (see section 5). |

## 3. How the main flows map to tables

**Volunteer journey:** `persons` → `volunteer_applications` (+ `application_documents`) → `payments` (registration fee) → `volunteers` → `volunteer_assignments` → `volunteer_attendance`.

**Money in:** `payments`. One row per fee attempt, unique references so the same payment cannot be recorded twice.

**Money out:** `project_budget_allocations` → `allowance_requests` → `allowance_disbursements`. A budget line funds requests, a request is verified and approved, and an approved request produces payouts.

**Who can do what:** `users` → `user_roles` → `roles` → `role_permissions` → `permissions`, limited in scope by `organizational_assignments`.

## 4. Rules enforced by the database

These hold no matter what the backend does. All were tested on the real Supabase project by `fgae-ims-database/tests/001_database_rules.sql` (41 checks, all passing on November 20, 2026).

| Rule | How it is enforced |
|---|---|
| Attendance is split into monthly partitions, with a catch-all default partition | Hand-written SQL in the first migration. A function (`create_attendance_partitions`) and a daily scheduled job (03:00 UTC, pg_cron) keep 24 months ahead and move any rows parked in the default partition. |
| One attendance record per assignment per day | Unique constraint on assignment and date. |
| Amounts must be positive | `CHECK` on payments, budget lines, allowance requests and disbursements. |
| End dates cannot be before start dates | `CHECK` on projects and assignments. |
| GPS must be a real coordinate; check-out cannot precede check-in | `CHECK` on attendance. |
| Payouts are a protected ledger | Triggers: rows cannot be deleted or truncated; only `status`, `providerTxnId`, `failureReason` and `completedAt` may change; a PAID or FAILED payout cannot change status again. |
| The same payout or payment cannot be processed twice | Unique `idempotencyKey` and `providerTxnId` on disbursements; unique `paymentReference` and `transactionReference` on payments. |
| A user has at most one active role | Partial unique index on `user_roles` (the team leader's migration). |
| Identity is unique | Unique phone and email on persons; unique email and phone on users; unique volunteer number; one volunteer per person; one volunteer per application. |
| History cannot be deleted from under its records | `RESTRICT` foreign keys: for example a project with budget lines, a request with a payout, a person who is a volunteer. |
| Nothing is readable through Supabase's public API | Row Level Security on every table, including each new attendance partition (the partition function switches it on). Execution of the partition function is revoked from the API roles. |

## 5. Rules the database does NOT enforce

The backend has to handle these, or the team has to decide to move them into the database.

| Gap | Why it matters |
|---|---|
| **Budget limits.** Nothing stops approved allowances from exceeding a budget line. | A 50,000 ETB line would accept requests worth millions. Needs a transaction in the backend using the `version` column, or a trigger. |
| **Status transitions.** Any status can be changed to any other. | A request could jump from DRAFT to PAID. The lifecycle lives in code. |
| **Separation of duties.** The requester, verifier and approver can be the same user. | Normally the person who requests money must not approve it. |
| **Consistency across tables.** For example, an assignment's facility belonging to its branch, an assignment's branch lying in the project's area, or attendance falling inside the assignment's dates. | Possible but unchecked. |
| **Organizational scope.** A branch assignment does not require an area. | Allowed by the schema. |
| **Audit log protection.** `audit_logs` is an ordinary table: rows can be changed or deleted, and it is not partitioned. | The design documents describe it as immutable and partitioned. |
| **Sensitive data encryption.** | The design documents ask for field-level encryption of sensitive personal data. Nothing in the database does this. |
| **Not modeled at all.** Membership (members, categories, applications) and HR (employees, positions, leave requests). | They appear in the design documents, but only as later phases. |

### Open decisions (waiting on the team leader)
1. **Application flow.** The schema has `AWAITING_PAYMENT`, `REGISTERED`, `CANCELLED`, with no review step, while the design describes a manager approving or rejecting (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED).
2. **Reapplication.** `volunteer_applications.personId` is unique, so a cancelled applicant can never apply again.
3. **Volunteer profile.** `volunteers` has no branch, status or membership status (the design has all three).
4. **Person details.** Email and birth date are required in `persons`; the design makes both optional.
5. **Payments.** `payments` has no fee type, payment method or idempotency key, and membership dues have no home.
6. **One active role per user.** Should a person ever hold two roles at once?
7. **Budget cap.** Enforce it in the database or the backend?
8. **"Immutable" ledger.** The ledger currently allows a webhook to update status and provider id. A fully append-only design would add an events table instead.

## 6. Working with the database

### Where things are
| What | Where |
|---|---|
| Schema | `fgae-ims-backend/prisma/schema.prisma` |
| Migrations | `fgae-ims-backend/prisma/migrations/` |
| Scheduling script (once per Supabase project) | `fgae-ims-database/ops/schedule_attendance_partitions.sql` |
| Rule tests | `fgae-ims-database/tests/001_database_rules.sql` |
| Sample data (development only) | `fgae-ims-database/seed/seed.sql` |
| Roles and permissions seed | `fgae-ims-backend/prisma/seed.ts` (run with `npx prisma db seed`) |

### Connecting
- `DATABASE_URL`: the transaction pooler (port 6543, `?pgbouncer=true`), used by the app.
- `DIRECT_URL`: the session pooler (port 5432), used by migrations.
- On the pooler, the username is `postgres.<project-ref>`, not `postgres`.
- These go in `fgae-ims-backend/.env`, which Git ignores. Never commit them.

### Routine tasks
| Task | How |
|---|---|
| Apply migrations | From `fgae-ims-backend`: `npx prisma migrate deploy` |
| Check the rules still hold | Run the test file in the Supabase SQL Editor. It rolls back automatically, so it is safe to run any time. Expect `ALL 41 TESTS PASSED`. Run it after every migration. |
| Load sample data | Run `seed.sql` in the SQL Editor on a development project only. It refuses to run if real organizations exist. |
| Refresh this dictionary | `node fgae-ims-database/tools/generate-data-dictionary.mjs`, then commit the changed file. |

### Prisma 5.19 limits to remember
- It cannot describe partitions, partial indexes, CHECK constraints or triggers. **Before applying any new migration, search it for `DROP`.** Prisma may try to drop objects it does not know about.
- Relations must be written on a single line (no multi-line `@relation(...)`).
- `prisma migrate dev` can fail through the Supabase pooler because of its shadow database. `migrate deploy` applies reviewed migrations without it.
- **Every new table needs Row Level Security switched on** in the migration that creates it: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
