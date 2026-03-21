# Phase 1: Database Migration - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace SQLite with Supabase PostgreSQL so all persistent data survives Render deployments, restarts, and idle spin-downs. This phase touches `app/db.py` and `app/config.py` only — no new tables, no new features.

</domain>

<decisions>
## Implementation Decisions

### Connection Approach
- **D-01:** Use raw SQL with `psycopg2` (sync) — mirrors current SQLite pattern, minimal change to existing CRUD functions
- **D-02:** Keep the per-call `_get_conn()` pattern but connect to Supabase PostgreSQL via connection string
- **D-03:** Replace SQLite-specific pragmas (WAL, foreign_keys) with PostgreSQL equivalents

### Local Development
- **D-04:** Use Supabase for both local dev and production — no dual-database logic, same connection string approach
- **D-05:** Connection string loaded from `DATABASE_URL` env var (Supabase provides this)

### Schema Evolution
- **D-06:** Use raw SQL scripts for schema creation — no Alembic or migration tools
- **D-07:** Keep `CREATE TABLE IF NOT EXISTS` pattern for idempotent init
- **D-08:** Future schema changes (Phase 2+) handled by adding new `CREATE TABLE IF NOT EXISTS` blocks

### Agent's Discretion
- User said "you decide, keep it simple" — all decisions above are agent-selected for minimal complexity
- No ORM, no migration tool, no connection pooling — raw and simple

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Database Implementation
- `app/db.py` — Current SQLite CRUD layer (125 lines, 2 tables, per-call connections)
- `app/config.py` — Settings class with `database_path` property

### Research
- `.planning/research/STACK.md` — Supabase PostgreSQL recommendation and rationale
- `.planning/research/ARCHITECTURE.md` — Database migration architecture plan
- `.planning/research/PITFALLS.md` — Render ephemeral FS and Supabase free tier risks

### Codebase Map
- `.planning/codebase/ARCHITECTURE.md` — Current system architecture
- `.planning/codebase/CONCERNS.md` — SQL injection risk in update functions (fix during migration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/db.py` `_get_conn()` pattern — can be adapted to return psycopg2 connection instead of sqlite3
- `app/db.py` CRUD functions — parameterized queries already use `?` placeholders (swap to `%s` for psycopg2)
- `app/config.py` Settings class — add `DATABASE_URL` field

### Established Patterns
- Per-call connections with `with conn:` context manager — keep this pattern
- `conn.row_factory = sqlite3.Row` for dict-like access — replicate with `psycopg2.extras.RealDictCursor`
- Functions return `dict` or `list[dict]` — no change needed

### Integration Points
- `app/main.py` `startup` event calls `init_db()` — keep this
- `app/extractor.py` imports from `db` — no changes needed if CRUD interface stays the same
- All other modules import `db.create_document`, `db.get_document`, etc. — interface unchanged

</code_context>

<specifics>
## Specific Ideas

- User preference: "keep it simple, no complex architectures unless necessary"
- Fix the SQL injection risk in `update_document()` and `update_page()` f-string column names during migration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-migration*
*Context gathered: 2026-03-21*
