# Roadmap: MBR Extractor v1

**Created:** 2026-03-21
**Milestone:** v1.0 — MSAT Batch Analytics Platform
**Phases:** 6
**Requirements:** 22

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Database Migration | Migrate from SQLite to Supabase PostgreSQL | DB-01, DB-02 | 2 |
| 2 | Projects & Batches | Enable product-level organization of MBRs | PROJ-01, PROJ-02, PROJ-03, PROJ-04 | 4 |
| 3 | Extraction Pipeline Improvements | Header dedup, smart naming, async processing | EXTR-01, EXTR-02, EXTR-03 | 3 |
| 4 | Trending & Analytics | Parameter trending with batch comparison charts | TREND-01, TREND-02, TREND-03, TREND-04 | 5 |
| 5 | Premium UI & Image Storage | Redesign UI, move images to browser storage | UI-01, UI-02, UI-03, IMG-01, IMG-02 | 4 |
| 6 | Auth & Deployment | Add authentication, deploy to Render | AUTH-01, AUTH-02, AUTH-03, DB-03 | 4 |

---

## Phase Details

### Phase 1: Database Migration
**Goal:** Replace SQLite with Supabase PostgreSQL so data persists on Render deployment

**Requirements:** DB-01, DB-02

**Success Criteria:**
1. Application connects to Supabase PostgreSQL and all CRUD operations work
2. Existing document/page schema migrated with no data model regressions

**Dependencies:** None — must be done first

---

### Phase 2: Projects & Batches
**Goal:** Enable users to organize MBRs by product and batch for structured data management

**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04

**Success Criteria:**
1. User can create a project with a name and description
2. User can define MBR types that belong to a project
3. User can upload MBRs into a project associated with a specific batch
4. User can view/manage all batches within a project

**Dependencies:** Phase 1 (PostgreSQL)

---

### Phase 3: Extraction Pipeline Improvements
**Goal:** Improve extraction quality with header dedup, meaningful identifiers, and async processing

**Requirements:** EXTR-01, EXTR-02, EXTR-03

**Success Criteria:**
1. Header metadata (product, lot#, MBR name) appears once per document, not per page
2. Documents identifiable by lot# + MBR name in the UI and API
3. Processing runs in background — user gets immediate HTTP response with status polling

**Dependencies:** Phase 1 (PostgreSQL), Phase 2 (project/batch context)

---

### Phase 4: Trending & Analytics
**Goal:** Visualize parameter trends within batches and compare trends across batches

**Requirements:** TREND-01, TREND-02, TREND-03, TREND-04

**Success Criteria:**
1. User can select a batch and see cell count/viability/confluency trended over days
2. User can select multiple batches and see overlaid trend comparison
3. User can choose which parameters to include in the trend
4. Charts are interactive with tooltips, legends, and zoom
5. Charts render client-side via Chart.js with no server-side dependencies

**Dependencies:** Phase 2 (projects/batches), Phase 3 (clean extracted data)

---

### Phase 5: Premium UI & Image Storage
**Goal:** Redesign the UI to look polished and professional; move image storage to browser

**Requirements:** UI-01, UI-02, UI-03, IMG-01, IMG-02

**Success Criteria:**
1. UI uses modern design language — premium typography, smooth animations, professional color palette
2. Dashboard provides project overview with batch status and quick trending access
3. Data viewer retains all current filtering/sorting with improved aesthetics
4. Page images stored/retrieved from browser IndexedDB, with re-render fallback

**Dependencies:** Phase 2 (project UI context), Phase 4 (trending UI context)

---

### Phase 6: Auth & Deployment
**Goal:** Add user authentication and deploy to Render for public access

**Requirements:** AUTH-01, AUTH-02, AUTH-03, DB-03

**Success Criteria:**
1. User can sign up and log in via email/password (Supabase Auth)
2. Each user's data is isolated — projects/batches/documents scoped by user_id
3. API routes require valid JWT — unauthenticated requests rejected
4. Application accessible via public Render URL with Supabase backend

**Dependencies:** All previous phases

---

## Requirement Coverage

All 22 v1 requirements mapped to phases. 0 unmapped. ✓

---
*Roadmap created: 2026-03-21*
