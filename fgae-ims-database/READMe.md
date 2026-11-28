# FGAE-IMS Database

PostgreSQL schema for the FGAE Integrated Management System, hosted on Supabase.

## Structure
- `migrations/`: schema SQL, run in numeric order
- `seed/`: fake development data only
- `tests/`: constraint and access-control tests
- `docs/`: ERD, data dictionary, decisions

## Rules
- Never commit passwords, API keys, or real personal data.
- Every schema change goes in a new numbered migration file.