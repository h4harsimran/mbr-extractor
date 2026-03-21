# Phase 1: Database Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 01-database-migration
**Areas discussed:** Connection approach, Local development, Schema evolution

---

## Connection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Raw psycopg2 | Mirror current SQLite pattern, minimal changes | ✓ |
| SQLAlchemy ORM | Full ORM with models, more abstraction | |
| asyncpg | Async PostgreSQL driver, requires async refactor | |

**User's choice:** Agent's discretion — "you decide, keep it simple"
**Notes:** User wants minimal complexity. Raw psycopg2 closest to existing sqlite3 pattern.

---

## Local Development

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase everywhere | Same DB for dev and prod, simplest | ✓ |
| SQLite locally + PG prod | Dual-database logic, more complex | |
| Docker PostgreSQL | Local PG container, more ops overhead | |

**User's choice:** Agent's discretion — "you decide, keep it simple"
**Notes:** Single connection string approach eliminates all dual-database complexity.

---

## Schema Evolution

| Option | Description | Selected |
|--------|-------------|----------|
| Raw SQL scripts | CREATE TABLE IF NOT EXISTS, idempotent | ✓ |
| Alembic migrations | Version-controlled schema changes | |
| Supabase migrations | Supabase CLI migration tool | |

**User's choice:** Agent's discretion — "you decide, keep it simple"
**Notes:** Raw SQL with idempotent creates is sufficient for this project size.

## Agent's Discretion

All three areas delegated. User's guiding principle: "keep it simple, no complex architectures unless necessary."

## Deferred Ideas

None — discussion stayed within phase scope.
