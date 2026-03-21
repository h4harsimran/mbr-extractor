# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Users can visualize how critical process parameters trend across days within a batch and compare trends across multiple batches of the same product
**Current focus:** Phase 1 — Database Migration

## Current Milestone

**v1.0 — MSAT Batch Analytics Platform**

| Phase | Name | Status | Requirements |
|-------|------|--------|-------------|
| 1 | Database Migration | ● Complete | DB-01, DB-02 |
| 2 | Projects & Batches | ○ Pending | PROJ-01, PROJ-02, PROJ-03, PROJ-04 |
| 3 | Extraction Pipeline | ○ Pending | EXTR-01, EXTR-02, EXTR-03 |
| 4 | Trending & Analytics | ○ Pending | TREND-01, TREND-02, TREND-03, TREND-04 |
| 5 | Premium UI & Images | ○ Pending | UI-01, UI-02, UI-03, IMG-01, IMG-02 |
| 6 | Auth & Deployment | ○ Pending | AUTH-01, AUTH-02, AUTH-03, DB-03 |

**Progress:** 0/6 phases complete

## Decision Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-03-21 | Supabase PostgreSQL over SQLite | Render ephemeral FS makes SQLite unusable |
| 2026-03-21 | Supabase Auth over Clerk | Bundled with Supabase, fewer dependencies |
| 2026-03-21 | Chart.js over Plotly Dash | Client-side, lighter, sufficient for trending |
| 2026-03-21 | Render free tier for hosting | Free, Python support, user preference |

---
*Last updated: 2026-03-21 after project initialization*
