# Technology Stack

## Language & Runtime

| Item | Detail |
|------|--------|
| Language | Python 3.10+ |
| Package manager | pip / `requirements.txt` |
| Virtual environment | `.venv` (manual, no Poetry/Pipenv) |
| Type hints | Used throughout (PEP 604 union syntax `str | Path`) |

---

## Core Frameworks

### FastAPI (≥ 0.110.0)
- **Role:** HTTP API + server-rendered HTML review UI
- **Entry point:** `app/main.py` → `app = FastAPI(…)`
- **Run command:** `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Key patterns:**
  - `@app.on_event("startup")` for DB init + directory creation
  - `StaticFiles` mount for serving rendered page images at `/images`
  - `Jinja2Templates` for review dashboard and data viewer
  - Response models via Pydantic (`response_model=…`)

### Pydantic v2 (≥ 2.6.0) + pydantic-settings (≥ 2.1.0)
- **Role:** Request/response validation, data schemas, configuration
- **Key files:**
  - `app/schemas.py` — `ExtractedRow`, `PageExtraction`, `ValidationResult`, API response models
  - `app/config.py` — `Settings(BaseSettings)` with `.env` loading
- **Notable:** `@model_validator(mode="after")` for auto-flagging rows needing review

### Uvicorn (≥ 0.27.0)
- ASGI server with `[standard]` extras (watchfiles, httptools, uvloop)

---

## AI / ML Dependencies

### google-genai (≥ 1.0.0)
- **Role:** Gemini multimodal API client for page image → structured JSON extraction
- **Key file:** `app/gemini_client.py`
- **Model used:** Configurable via `GEMINI_MODEL` env var (default: `gemini-2.0-flash`)
- **Pattern:** `genai.Client(api_key=…)` → `client.models.generate_content(…)` with `types.Content`, `types.Part`
- **Config:** `temperature=0.1`, `max_output_tokens=8192`

---

## Document Processing

### PyMuPDF / fitz (≥ 1.24.0)
- **Role:** PDF page → high-resolution PNG rendering
- **Key file:** `app/pdf_renderer.py`
- **Pattern:** `fitz.open()` → `page.get_pixmap(matrix=…)` → `.save()`
- **DPI:** Configurable via `RENDER_DPI` (default 300, zoom = DPI/72)

---

## Data Storage

### SQLite (stdlib `sqlite3`)
- **Role:** Document/page metadata and status tracking
- **Key file:** `app/db.py`
- **Database path:** `data/mbr_extractor.db` (configurable)
- **Tables:** `documents`, `pages`
- **Pragmas:** `journal_mode=WAL`, `foreign_keys=ON`
- **Pattern:** Per-call `_get_conn()` (no connection pooling)

### Filesystem
- Raw Gemini JSON: `data/raw_json/<doc_id>/page_NNNN_raw.json`
- Normalized JSON: `data/normalized_json/<doc_id>/page_NNNN_normalized.json`
- Rendered images: `data/images/<doc_id>/page_NNNN.png`
- CSV exports: `data/exports/<doc_id>.csv`
- Uploaded PDFs: `data/uploads/<doc_id>.pdf`

---

## Templating & Frontend

### Jinja2 (≥ 3.1.0)
- Server-side HTML rendering for review UI
- 4 templates: `base.html`, `review_dashboard.html`, `review_document.html`, `data_viewer.html`

### Vanilla CSS + JavaScript
- Dark-mode design system with CSS custom properties in `base.html`
- Google Fonts: Inter, JetBrains Mono
- `data_viewer.html` has client-side JS for column toggles, search, filtering, sorting
- Fetches data via `/documents/{id}/normalized` JSON API

---

## Other Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| python-multipart | ≥ 0.0.9 | File upload parsing for FastAPI |
| python-dotenv | ≥ 1.0.0 | `.env` file loading |
| aiofiles | ≥ 23.2.0 | Async file operations (for static file serving) |
| pytest | ≥ 8.0.0 | Test framework |

---

## Configuration

All settings loaded via `pydantic-settings` from `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `RENDER_DPI` | `300` | PDF → PNG rendering DPI |
| `MAX_RETRIES` | `3` | Gemini API retry attempts |
| `RETRY_BASE_DELAY` | `2.0` | Exponential backoff base (seconds) |
| `DATA_DIR` | `data` | Root data directory |
| `DB_PATH` | `data/mbr_extractor.db` | SQLite database path |

Configuration class: `app/config.py` → `Settings(BaseSettings)` with derived `@property` path builders.
