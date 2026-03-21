# Research Summary — MBR Extractor v2

## Key Findings

### Stack
- **Keep:** Python/FastAPI, Gemini AI, PyMuPDF, Pydantic v2
- **Add:** Supabase (PostgreSQL + Auth), Chart.js for client-side charting
- **Replace:** SQLite → Supabase PostgreSQL (Render ephemeral FS makes SQLite unusable)
- **Host:** Render free tier (750 hrs/mo, cold starts, ephemeral FS)

### Table Stakes for v2
- Header metadata dedup (extract once per document)
- Meaningful document IDs (lot# + MBR name)
- Project/batch organization (group MBRs by product)
- Parameter trending with overlay batch comparison
- Premium UI redesign
- Online deployment with auth

### Watch Out For
1. **Render ephemeral FS** — must migrate to external DB before deploy (data loss on every restart)
2. **Supabase free tier pauses** — needs keep-alive strategy after 7 days idle
3. **Header dedup accuracy** — Gemini gives slightly different values across pages; needs normalization
4. **Parameter name matching** — same parameter labeled differently across MBRs; needs alias system
5. **Cold starts** — 30-60s delay after idle; needs loading UI + optional keep-alive

### Architecture Decision
Migrate from monolithic SQLite to Supabase PostgreSQL with expanded data model:
`projects → batches → documents → pages → extracted_rows`

Build order: DB migration → data model → extraction pipeline → project UI → trending → premium UI → auth → deploy

## Files
- `.planning/research/STACK.md` — Technology recommendations
- `.planning/research/FEATURES.md` — Feature categorization
- `.planning/research/ARCHITECTURE.md` — System design changes
- `.planning/research/PITFALLS.md` — Risk mitigation
