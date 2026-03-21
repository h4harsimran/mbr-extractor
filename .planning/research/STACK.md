# Stack Research — MBR Extractor v2

## Current Stack (Keeping)
- **Backend:** Python 3.10+ / FastAPI — large existing codebase, Gemini SDK is Python
- **AI Extraction:** Google Gemini (`google-genai`) — multimodal image→JSON
- **PDF Rendering:** PyMuPDF (`fitz`) — PDF→PNG per page
- **Validation:** Pydantic v2 — schema validation + auto-flagging

## Recommended Additions

### Database: Supabase PostgreSQL (Free Tier)
- **Why:** Render free tier has ephemeral filesystem — SQLite databases are wiped on restart/redeploy
- **Free tier:** 500 MB storage, 50K MAU auth, unlimited API requests, 2 projects
- **Caveat:** Free projects pause after 7 days of inactivity
- **Alternative considered:** Render PostgreSQL — 30-day expiration, impractical for production

### Authentication: Supabase Auth (bundled)
- **Why:** Comes free with Supabase, saves adding a separate auth provider
- **Features:** Email/password, magic links, social auth, JWT-based
- **FastAPI integration:** Validate JWTs via `python-jose` or `PyJWT` middleware
- **Alternative considered:** Clerk (50K free MRUs) — good but adds another external dependency

### Charting: Chart.js (client-side)
- **Why:** Lightweight JS library, renders in browser, no Python server overhead
- **Good for:** Line charts (cell count over days), overlay comparisons across batches
- **Alternative considered:** Plotly Dash — more powerful but requires server-side rendering, heavier dependency, overkill for this use case
- **Confidence:** High — Chart.js handles overlay line charts, time-series, and scientific data well

### Frontend: Jinja2 templates (enhanced) or React SPA
- **Current:** Server-rendered Jinja2 templates with vanilla CSS/JS
- **Recommendation:** Keep Jinja2 for now, add Chart.js for interactivity — avoids full rewrite
- **Future option:** React/Next.js SPA if frontend complexity grows

### Hosting: Render Free Tier
- **Web service:** 750 free instance hours/month, cold starts after 15 min idle
- **CRITICAL:** Ephemeral filesystem — all local files lost on restart
- **Solution:** Store all persistent data in Supabase PostgreSQL, images in browser IndexedDB
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## What NOT to Use
- **SQLite in production** — will lose data on Render restarts
- **Plotly Dash** — server-side rendering adds complexity, Chart.js sufficient
- **Celery/Redis** — free tier won't support background workers; use FastAPI BackgroundTasks
- **S3/GCS for images** — costs money; browser IndexedDB is free
