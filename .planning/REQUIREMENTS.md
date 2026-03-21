# Requirements: MBR Extractor

**Defined:** 2026-03-21
**Core Value:** Users can visualize how critical process parameters trend across days within a batch and compare trends across multiple batches of the same product

## v1 Requirements

### Database & Infrastructure

- [ ] **DB-01**: Application uses Supabase PostgreSQL instead of SQLite for persistent data storage
- [ ] **DB-02**: All existing document/page metadata tables migrated to PostgreSQL schema
- [ ] **DB-03**: Application deployed on Render free tier accessible via public URL

### Extraction Pipeline

- [ ] **EXTR-01**: Header metadata (product name, lot#, MBR name) extracted once per document and deduplicated across pages
- [ ] **EXTR-02**: Documents identified and saved by lot# + MBR name instead of random hex ID
- [ ] **EXTR-03**: Processing runs asynchronously via background tasks (not blocking HTTP request)

### Projects & Batches

- [ ] **PROJ-01**: User can create a project representing a product (e.g., "Product XYZ")
- [ ] **PROJ-02**: User can define which MBR types belong to a project
- [ ] **PROJ-03**: User can upload MBRs one by one into a project, each associated with a batch
- [ ] **PROJ-04**: User can create and manage batches within a project (each batch = one production run)

### Trending & Analytics

- [ ] **TREND-01**: User can select parameters to trend within a single batch (e.g., cell count over days)
- [ ] **TREND-02**: User can overlay trend graphs from multiple batches of the same product for comparison
- [ ] **TREND-03**: Trending supports key MSAT parameters: cell count, viability, confluency, and user-selected custom parameters
- [ ] **TREND-04**: Charts rendered client-side using Chart.js with interactive tooltips and legends

### User Interface

- [ ] **UI-01**: UI redesigned with premium, modern aesthetics (dark mode, smooth animations, professional typography)
- [ ] **UI-02**: Dashboard shows project overview with batch status and quick access to trending
- [ ] **UI-03**: Data viewer supports inline exploration of extracted parameters with filtering and sorting

### Authentication & Multi-User

- [ ] **AUTH-01**: User can sign up and log in via Supabase Auth (email/password)
- [ ] **AUTH-02**: Each user's projects, batches, and documents are isolated (data scoped by user)
- [ ] **AUTH-03**: Protected API routes require valid JWT token

### Image Storage

- [ ] **IMG-01**: Rendered page images stored in browser IndexedDB instead of server filesystem
- [ ] **IMG-02**: Images loaded from IndexedDB during review, with fallback re-render if missing

## v2 Requirements

### Advanced Analytics

- **ADV-01**: Statistical overlays on trend charts (mean, median, range bands across batches)
- **ADV-02**: Anomaly detection — auto-flag batches where parameters deviate from historical norms
- **ADV-03**: Parameter correlation charts (e.g., cell count vs viability scatter plot)

### Process Intelligence

- **PROC-01**: Template management — define expected parameters per MBR type, flag missing entries
- **PROC-02**: Batch health scoring — aggregate metrics per batch (% within spec)
- **PROC-03**: Process stage tracking — map MBR steps to named process stages

### Platform

- **PLAT-01**: Social auth (Google OAuth)
- **PLAT-02**: Multi-device image sync (cloud storage for images)
- **PLAT-03**: Audit trail — who uploaded what, when, version history

## Out of Scope

| Feature | Reason |
|---------|--------|
| 21 CFR Part 11 compliance | Not an EBR replacement, post-hoc analysis tool |
| Real-time instrument integration | Out of scope — offline batch record analysis |
| Mobile-native app | Web-responsive sufficient |
| OCR fallback / manual entry | Not useful at this stage |
| Multi-user collaboration | Single-user workflow per project for now |
| Self-hosted deployment | Using Render managed hosting |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 6 | Pending |
| EXTR-01 | Phase 3 | Pending |
| EXTR-02 | Phase 3 | Pending |
| EXTR-03 | Phase 3 | Pending |
| PROJ-01 | Phase 2 | Pending |
| PROJ-02 | Phase 2 | Pending |
| PROJ-03 | Phase 2 | Pending |
| PROJ-04 | Phase 2 | Pending |
| TREND-01 | Phase 4 | Pending |
| TREND-02 | Phase 4 | Pending |
| TREND-03 | Phase 4 | Pending |
| TREND-04 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| AUTH-01 | Phase 6 | Pending |
| AUTH-02 | Phase 6 | Pending |
| AUTH-03 | Phase 6 | Pending |
| IMG-01 | Phase 5 | Pending |
| IMG-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
