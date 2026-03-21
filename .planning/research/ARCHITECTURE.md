# Architecture Research — MBR Extractor v2

## Current Architecture (Keeping Core Pipeline)
```
Upload PDF → PyMuPDF render → Gemini extract → Pydantic validate → Store → Export/Visualize
```

## Proposed Architecture Changes

### 1. Database Migration: SQLite → Supabase PostgreSQL
- **Why:** Render ephemeral FS means SQLite data is lost on restart
- **What moves:** `documents`, `pages` tables + new `projects`, `batches`, `parameters` tables
- **Driver:** `asyncpg` or `psycopg2` via SQLAlchemy async or raw queries
- **Migration path:** Replace `app/db.py` with PostgreSQL connection, keep same CRUD interface

### 2. Data Model Expansion
```
projects
  └─ batches (product run instances)
       └─ documents (individual MBRs)
            └─ pages (per-page data)
                 └─ extracted_rows (parameter data)
                      └─ document_metadata (header info — lot#, product, MBR name)
```

### 3. Image Storage: Server FS → Browser IndexedDB
- **Upload flow:** PDF uploaded to server → pages rendered → PNGs sent to client → stored in IndexedDB
- **Review flow:** Images loaded from IndexedDB, not server
- **Extraction flow:** Server processes images during extraction, then discards
- **Tradeoff:** Images not available across devices/browsers, but saves hosting costs

### 4. Charting Layer: Chart.js Client-Side
- **Data flow:** API endpoint returns parameter time-series data → Chart.js renders in browser
- **Chart types:** Line charts (trending), multi-dataset line charts (batch overlay)
- **Interaction:** User selects project → batch(es) → parameter(s) → chart renders

### 5. Authentication Layer
- **Supabase Auth** issues JWT on login
- **FastAPI middleware** validates JWT on protected routes
- **User isolation:** All queries filtered by `user_id`

## Component Boundaries
- **API layer** (`app/main.py`) — HTTP routes, auth middleware, template rendering
- **Pipeline** (`app/extractor.py`) — PDF → extract → validate → persist (unchanged core)
- **Data layer** (`app/db.py`) — PostgreSQL CRUD (replaces SQLite)
- **Analytics** (new) — parameter aggregation, time-series queries, batch comparison
- **Charting** (client-side) — Chart.js rendering from API data

## Build Order (Dependencies)
1. Database migration (SQLite → PostgreSQL) — everything depends on this
2. Data model expansion (projects, batches) — before UI can reference them
3. Header dedup + smart naming — extraction pipeline changes
4. Project/batch UI — CRUD for organizing MBRs
5. Trending/analytics API + charts — depends on data model
6. Premium UI redesign — can overlap with functional work
7. Auth + deployment — final steps before going live
