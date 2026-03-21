# MBR Extractor

## What This Is

A batch analytics platform for MSAT teams that extracts structured data from scanned Master Batch Record (MBR) PDFs using Gemini multimodal AI, then enables cross-batch trending and comparison of critical process parameters like cell counts, viability, and confluency. Built for non-technical users who need to upload MBRs, visualize batch health, and compare performance across production runs — without downloading CSVs into Excel.

## Core Value

Users can visualize how critical process parameters (cell count, viability, confluency) trend across days within a batch and compare trends across multiple batches of the same product — turning scattered PDF data into actionable manufacturing insights.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ User can upload PDF batch records via web UI — existing
- ✓ Each PDF page is rendered to high-res PNG for Gemini extraction — existing
- ✓ Gemini AI extracts structured rows from each page (one parameter per row) — existing
- ✓ Extracted data is validated via Pydantic with auto-flagging for review — existing
- ✓ User can export extracted data to CSV — existing
- ✓ User can review extracted data per page with images in review UI — existing
- ✓ User can filter, sort, and toggle columns in interactive data viewer — existing
- ✓ Extraction confidence scores displayed per row — existing
- ✓ Rows with missing values auto-flagged for human review — existing
- ✓ SQLite tracks document/page metadata and processing status — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Header metadata (product, lot#, MBR name) extracted once per document and deduplicated across pages
- [ ] Documents saved/identified by lot# + MBR name (unique identifier) instead of random hex ID
- [ ] User can create a project (representing a product like "Product XYZ")
- [ ] User can define which MBRs belong to a project
- [ ] User can upload MBRs one by one into a project, each representing a batch run
- [ ] User can select parameters to trend within a single batch (e.g., cell count over days)
- [ ] User can overlay trend graphs from multiple batches of the same product for comparison
- [ ] Trending supports key MSAT parameters: cell count, viability, confluency, and user-selected custom parameters
- [ ] UI redesigned with premium, modern aesthetics (not generic/AI-looking)
- [ ] Application deployed on Render free tier for non-technical user access
- [ ] Image data stored in browser storage (not server) to minimize hosting costs
- [ ] Free-tier database for persistent storage (user data, projects, extracted parameters)
- [ ] Authentication so multiple users can manage their own projects

### Out of Scope

- Audit trail / version history — not needed yet
- OCR fallback for manual entry — not useful at this stage
- Real-time collaboration — single-user workflow per project
- Mobile-native app — web-responsive is sufficient
- Video/image upload (non-PDF) — MBRs are always scanned PDFs
- Self-hosted deployment — using Render managed hosting

## Context

- **Domain:** MSAT (Manufacturing Science and Technology) in biopharmaceutical manufacturing
- **Users:** MSAT data analysts, process engineers — non-technical, expect polished UIs
- **MBR structure:** A product (e.g., Product XYZ) has ~10 MBRs covering different process steps. Each MBR may run on different days. Multiple batches of each product are produced over time.
- **Key parameters:** Cell counts (done frequently during process), viability, confluency — these track cell growth/expansion health
- **Existing stack:** Python/FastAPI backend, Gemini AI extraction, PyMuPDF rendering, SQLite, Jinja2 templates
- **Target deployment:** Render free tier, free-tier database, Cloudflare Workers possible future migration

## Constraints

- **Budget**: Free-tier hosting only (Render, free DB) — Gemini API key is the only paid resource
- **Tech stack**: Python/FastAPI backend (existing), can add JS frontend framework for premium UI
- **Image storage**: Browser-side storage (IndexedDB/localStorage) to avoid server storage costs
- **Auth**: Free-tier auth provider (Supabase free, Clerk free, or similar)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Python/FastAPI backend | Large existing codebase, Gemini SDK is Python | — Pending |
| Deploy on Render free tier | Free, supports Python, easy for MVP | — Pending |
| Browser storage for images | Avoid server storage costs for rendered PNGs | — Pending |
| Lot# + MBR name as document ID | Domain-meaningful identifiers vs random hex | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
